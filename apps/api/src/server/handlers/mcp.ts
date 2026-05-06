import {
	filterMcpScopes,
	isMcpClientProfile,
	isMcpScope,
	type McpClientProfile,
	type McpScope,
	mcpScopes,
} from "@app/mcp-contracts";
import { addMinutes } from "date-fns";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { type ApiContext, createApiError } from "../api-context";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import {
	createOAuthAuthorizationCodeValue,
	createOpaqueMcpToken,
	hashOAuthAuthorizationCode,
} from "../mcp/token-utils";

const AUTHORIZATION_CODE_TTL_MINUTES = 10;

const createPatInput = z.object({
	name: z.string().min(1).max(80),
	clientName: z.string().min(1).max(80).optional(),
	clientProfile: z.string().optional(),
	scopes: z.array(z.string()).min(1).max(mcpScopes.length),
	expiresInDays: z.number().int().min(1).max(366).nullable().optional(),
});

const revokePatInput = z.object({
	tokenId: z.string().min(1),
});

const revokeOAuthConnectionInput = z.object({
	accessTokenId: z.string().min(1),
});

const oauthConsentInput = z.object({
	response_type: z.literal("code"),
	client_id: z.string().min(1).max(200),
	redirect_uri: z.string().url(),
	scope: z.string().max(1000).optional(),
	state: z.string().max(1000).optional(),
	code_challenge: z.string().min(32).max(256),
	code_challenge_method: z.literal("S256"),
});

function parseClientProfile(value: string | undefined): McpClientProfile {
	return value && isMcpClientProfile(value) ? value : "local-dev";
}

function parseRequestedScopes(scopeValue: string | undefined): McpScope[] {
	if (!scopeValue?.trim()) return [];
	const rawScopes = scopeValue.split(/\s+/).filter(Boolean);
	const invalidScope = rawScopes.find((scope) => !isMcpScope(scope));
	if (invalidScope) {
		throw createApiError(`Unsupported MCP scope: ${invalidScope}`, 400);
	}
	return filterMcpScopes(rawScopes);
}

function resolveAllowedRequestedScopes(input: {
	requestedScopes: readonly McpScope[];
	clientScopes: readonly string[];
}): McpScope[] {
	const clientScopes = filterMcpScopes(input.clientScopes);
	const requestedScopes =
		input.requestedScopes.length > 0 ? input.requestedScopes : clientScopes;
	const allowed = new Set(clientScopes);
	const deniedScope = requestedScopes.find((scope) => !allowed.has(scope));
	if (deniedScope) {
		throw createApiError(
			`MCP client is not allowed to request ${deniedScope}`,
			400,
		);
	}
	return [...requestedScopes];
}

function getExpiresAt(expiresInDays: number | null | undefined): Date | null {
	if (!expiresInDays) return null;
	return new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
}

async function getOAuthConsentDetails(ctx: ApiContext, body: unknown) {
	const input = oauthConsentInput.parse(body);
	const client = await ctx.db.mcpOAuthClient.findFirst({
		where: { clientId: input.client_id, revokedAt: null },
		select: {
			id: true,
			clientId: true,
			name: true,
			clientProfile: true,
			redirectUris: true,
			scopes: true,
		},
	});

	if (!client) throw createApiError("Unknown MCP OAuth client", 404);
	if (!client.redirectUris.includes(input.redirect_uri)) {
		throw createApiError("Invalid MCP OAuth redirect URI", 400);
	}

	const requestedScopes = resolveAllowedRequestedScopes({
		requestedScopes: parseRequestedScopes(input.scope),
		clientScopes: client.scopes,
	});

	return { client, input, requestedScopes };
}

function buildRedirectUrl(input: {
	redirectUri: string;
	code: string;
	state?: string;
}): string {
	const redirectUrl = new URL(input.redirectUri);
	redirectUrl.searchParams.set("code", input.code);
	if (input.state) redirectUrl.searchParams.set("state", input.state);
	return redirectUrl.toString();
}

export const mcp = {
	listPersonalAccessTokens: withAuth(async (ctx: AuthenticatedContext) => {
		const tokens = await ctx.db.mcpPersonalAccessToken.findMany({
			where: { userId: ctx.userId },
			select: {
				id: true,
				name: true,
				tokenPrefix: true,
				scopes: true,
				clientName: true,
				expiresAt: true,
				revokedAt: true,
				lastUsedAt: true,
				createdAt: true,
			},
			orderBy: { createdAt: "desc" },
		});

		return { tokens };
	}),

	createPersonalAccessToken: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = createPatInput.parse(body);
			const scopes = filterMcpScopes(input.scopes);
			if (scopes.length !== input.scopes.length) {
				throw createApiError("One or more MCP scopes are invalid", 400);
			}

			const tokenMaterial = createOpaqueMcpToken("fin_dev");
			const token = await ctx.db.mcpPersonalAccessToken.create({
				data: {
					userId: ctx.userId,
					name: input.name.trim(),
					clientName:
						input.clientName?.trim() || parseClientProfile(input.clientProfile),
					tokenPrefix: tokenMaterial.tokenPrefix,
					tokenHash: tokenMaterial.tokenHash,
					scopes,
					expiresAt: getExpiresAt(input.expiresInDays),
				},
				select: {
					id: true,
					name: true,
					tokenPrefix: true,
					scopes: true,
					clientName: true,
					expiresAt: true,
					createdAt: true,
				},
			});

			logger.info("MCP personal access token created", {
				feature: "mcp",
				operation: "createPersonalAccessToken",
				userId: ctx.userId,
				tokenId: token.id,
			});

			return { token: { ...token, token: tokenMaterial.token } };
		},
	),

	revokePersonalAccessToken: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = revokePatInput.parse(body);
			await ctx.db.mcpPersonalAccessToken.updateMany({
				where: { id: input.tokenId, userId: ctx.userId, revokedAt: null },
				data: { revokedAt: new Date() },
			});

			logger.info("MCP personal access token revoked", {
				feature: "mcp",
				operation: "revokePersonalAccessToken",
				userId: ctx.userId,
				tokenId: input.tokenId,
			});

			return { success: true };
		},
	),

	listOAuthConnections: withAuth(async (ctx: AuthenticatedContext) => {
		const connections = await ctx.db.mcpOAuthAccessToken.findMany({
			where: { userId: ctx.userId },
			select: {
				id: true,
				tokenPrefix: true,
				scopes: true,
				expiresAt: true,
				refreshTokenExpiresAt: true,
				revokedAt: true,
				lastUsedAt: true,
				createdAt: true,
				oauthClient: {
					select: { clientId: true, name: true, clientProfile: true },
				},
			},
			orderBy: { createdAt: "desc" },
		});

		return { connections };
	}),

	revokeOAuthConnection: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = revokeOAuthConnectionInput.parse(body);
			await ctx.db.mcpOAuthAccessToken.updateMany({
				where: { id: input.accessTokenId, userId: ctx.userId, revokedAt: null },
				data: { revokedAt: new Date() },
			});

			logger.info("MCP OAuth connection revoked", {
				feature: "mcp",
				operation: "revokeOAuthConnection",
				userId: ctx.userId,
				accessTokenId: input.accessTokenId,
			});

			return { success: true };
		},
	),

	getOAuthConsentRequest: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { client, input, requestedScopes } = await getOAuthConsentDetails(
				ctx,
				body,
			);

			return {
				client: {
					clientId: client.clientId,
					name: client.name,
					clientProfile: client.clientProfile,
				},
				redirectUri: input.redirect_uri,
				scopes: requestedScopes,
				state: input.state ?? null,
			};
		},
	),

	approveOAuthConsent: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { client, input, requestedScopes } = await getOAuthConsentDetails(
				ctx,
				body,
			);
			const code = createOAuthAuthorizationCodeValue();
			const expiresAt = addMinutes(new Date(), AUTHORIZATION_CODE_TTL_MINUTES);

			await ctx.db.mcpOAuthAuthorizationCode.create({
				data: {
					userId: ctx.userId,
					oauthClientId: client.id,
					codeHash: hashOAuthAuthorizationCode(code),
					codeChallenge: input.code_challenge,
					codeChallengeMethod: input.code_challenge_method,
					redirectUri: input.redirect_uri,
					scopes: requestedScopes,
					expiresAt,
					ipAddress:
						typeof ctx.req.headers["x-forwarded-for"] === "string"
							? ctx.req.headers["x-forwarded-for"].split(",")[0]?.trim()
							: ctx.req.socket.remoteAddress,
					userAgent:
						typeof ctx.req.headers["user-agent"] === "string"
							? ctx.req.headers["user-agent"]
							: undefined,
				},
			});

			logger.info("MCP OAuth consent approved", {
				feature: "mcp",
				operation: "approveOAuthConsent",
				userId: ctx.userId,
				clientId: client.clientId,
			});

			return {
				redirectUrl: buildRedirectUrl({
					redirectUri: input.redirect_uri,
					code,
					state: input.state,
				}),
				expiresAt,
			};
		},
	),
};
