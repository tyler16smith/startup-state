import { filterMcpScopes, mcpScopes } from "@app/mcp-contracts";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Request, type Response } from "express";
import { z } from "zod";
import {
	exchangeAuthorizationCode,
	getOAuthAuthorizationRequest,
	refreshOAuthAccessToken,
	registerDynamicOAuthClient,
	revokeOAuthToken,
} from "~/auth/oauth-service";
import { verifyAuthorizationHeader } from "~/auth/verify-token";
import { getEnv } from "~/config/env";
import {
	OAuthClientRegistrationPolicyError,
	resolveOAuthClientRegistration,
} from "~/hosts/registration-policy";
import { logger, normalizeError } from "~/lib/logger";
import { createFinMcpServer } from "~/mcp-server";
import { checkAnonymousRateLimit } from "~/rate-limit/rate-limit";
import { getRegisteredTools } from "~/tools/registry";

const protectedResourcePath = "/.well-known/oauth-protected-resource";
const pathSpecificProtectedResourcePath = `${protectedResourcePath}/mcp`;
const supportedGrantTypes = ["authorization_code", "refresh_token"] as const;
const supportedResponseTypes = ["code"] as const;

const clientRegistrationInput = z.object({
	redirect_uris: z.array(z.string().url()).min(1).max(10),
	token_endpoint_auth_method: z.literal("none").optional(),
	grant_types: z.array(z.string().min(1).max(80)).min(1).max(5).optional(),
	response_types: z.array(z.string().min(1).max(80)).min(1).max(5).optional(),
	client_name: z.string().trim().min(1).max(120).optional(),
	scope: z.string().trim().max(1000).optional(),
	client_uri: z.string().url().optional(),
	software_id: z.string().max(200).optional(),
	software_version: z.string().max(80).optional(),
});

type ClientRegistrationInput = z.infer<typeof clientRegistrationInput>;

class OAuthRequestError extends Error {
	constructor(
		readonly oauthError: string,
		message: string,
	) {
		super(message);
	}
}

class OAuthRateLimitError extends OAuthRequestError {
	readonly statusCode = 429;

	constructor() {
		super("slow_down", "OAuth rate limit exceeded");
	}
}

function getHeader(req: Request, name: string): string | undefined {
	const value = req.headers[name.toLowerCase()];
	return Array.isArray(value) ? value[0] : value;
}

function getRequestIdentifier(req: Request): string {
	const forwardedFor = getHeader(req, "x-forwarded-for")
		?.split(",")
		.at(0)
		?.trim();
	return forwardedFor || req.ip || req.socket.remoteAddress || "unknown";
}

function getMcpResource(env: ReturnType<typeof getEnv>) {
	return `${env.MCP_BASE_URL}/mcp`;
}

function getProtectedResourceMetadata(env: ReturnType<typeof getEnv>) {
	return {
		resource: getMcpResource(env),
		resource_name: "Startup State MCP",
		bearer_methods_supported: ["header"],
		authorization_servers: [env.MCP_OAUTH_ISSUER ?? env.MCP_BASE_URL],
		scopes_supported: [...mcpScopes],
		resource_documentation: `${env.MCP_BASE_URL}/docs/mcp`,
	};
}

function getRegisteredToolDocs() {
	return getRegisteredTools().map((tool) => ({
		name: tool.contract.name,
		title: tool.contract.title,
		description: tool.contract.description,
		requiredScopes: [...tool.contract.requiredScopes],
		readOnly: tool.contract.safetyClass === "read_only_app_data",
	}));
}

function getMcpDocumentation(env: ReturnType<typeof getEnv>) {
	return {
		name: "Startup State MCP",
		description:
			"Connect external agents to Startup State Navigator with scoped read access.",
		resource: getMcpResource(env),
		health: `${env.MCP_BASE_URL}/health`,
		scopes: [...mcpScopes],
		tools: getRegisteredToolDocs(),
		connectionExamples: {
			remote: {
				command: "npx",
				args: ["-y", "mcp-remote", getMcpResource(env)],
			},
			stdio: {
				type: "stdio",
				command: "pnpm",
				args: ["--filter", "@app/mcp", "dev:stdio"],
				env: ["STARTUP_STATE_MCP_TOKEN", "DATABASE_URL", "MCP_TOKEN_PEPPER"],
			},
		},
	};
}

function getAuthChallenge(env: ReturnType<typeof getEnv>) {
	return `Bearer resource_metadata="${env.MCP_BASE_URL}${pathSpecificProtectedResourcePath}"`;
}

function getRegistrationGrants(input: ClientRegistrationInput): string[] {
	const grantTypes = input.grant_types ?? [...supportedGrantTypes];
	const unsupportedGrant = grantTypes.find(
		(value) => !(supportedGrantTypes as readonly string[]).includes(value),
	);
	if (unsupportedGrant) {
		throw new Error(`Unsupported OAuth grant type: ${unsupportedGrant}`);
	}
	if (!grantTypes.includes("authorization_code")) {
		throw new Error(
			"OAuth client registration requires authorization_code grant",
		);
	}
	return [...new Set(grantTypes)];
}

function assertSupportedResponseTypes(input: ClientRegistrationInput) {
	const responseTypes = input.response_types ?? [...supportedResponseTypes];
	const unsupportedResponseType = responseTypes.find(
		(value) => !(supportedResponseTypes as readonly string[]).includes(value),
	);
	if (unsupportedResponseType) {
		throw new Error(
			`Unsupported OAuth response type: ${unsupportedResponseType}`,
		);
	}
}

function assertResourceParameter(input: {
	resource: string | undefined;
	env: ReturnType<typeof getEnv>;
}) {
	if (!input.resource) return;
	if (input.resource !== getMcpResource(input.env)) {
		throw new OAuthRequestError(
			"invalid_target",
			"OAuth resource parameter must match the MCP protected resource",
		);
	}
}

function getOAuthErrorCode(error: unknown, fallback: string) {
	return error instanceof OAuthRequestError ? error.oauthError : fallback;
}

function getOAuthStatusCode(error: unknown) {
	return error instanceof OAuthRateLimitError ? error.statusCode : 400;
}

async function assertOAuthRateLimit(input: {
	req: Request;
	operation: string;
	limit: number;
}) {
	const rateLimit = await checkAnonymousRateLimit({
		identifier: getRequestIdentifier(input.req),
		operation: input.operation,
		limit: input.limit,
	});
	if (!rateLimit.allowed) throw new OAuthRateLimitError();
}

async function handleOAuthClientRegistration(req: Request, res: Response) {
	const env = getEnv();
	try {
		await assertOAuthRateLimit({
			req,
			operation: "oauthRegister",
			limit: 20,
		});
		const input = clientRegistrationInput.parse(req.body);
		if ((input.token_endpoint_auth_method ?? "none") !== "none") {
			res.status(400).json({
				error: "invalid_client_metadata",
				error_description: "Only public PKCE OAuth clients are supported",
			});
			return;
		}

		assertSupportedResponseTypes(input);
		const grants = getRegistrationGrants(input);
		const registration = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: input.redirect_uris,
				clientName: input.client_name,
				clientUri: input.client_uri,
				softwareId: input.software_id,
				softwareVersion: input.software_version,
				scope: input.scope,
			},
			env,
		});
		const client = await registerDynamicOAuthClient({
			name: registration.clientName,
			clientProfile: registration.clientProfile,
			redirectUris: registration.redirectUris,
			scopes: registration.scopes,
			grants,
			requestsPerMinute: registration.requestsPerMinute,
		});

		res.status(201).json({
			client_id: client.clientId,
			client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
			client_name: client.name,
			redirect_uris: client.redirectUris,
			token_endpoint_auth_method: "none",
			grant_types: client.grants,
			response_types: [...supportedResponseTypes],
			scope: filterMcpScopes(client.scopes).join(" "),
		});
	} catch (error) {
		const normalized = normalizeError(error);
		const logContext = {
			feature: "mcp",
			operation: "oauthRegister",
			errorCode: normalized.errorCode,
			errorMessage: normalized.errorMessage,
		};
		if (
			error instanceof OAuthClientRegistrationPolicyError ||
			error instanceof OAuthRateLimitError ||
			error instanceof z.ZodError
		) {
			logger.warn("MCP OAuth client registration rejected", logContext);
		} else {
			logger.logError(
				"MCP OAuth client registration failed",
				error,
				logContext,
			);
		}
		res.status(getOAuthStatusCode(error)).json({
			error: getOAuthErrorCode(error, "invalid_client_metadata"),
			error_description:
				error instanceof Error
					? error.message
					: "Invalid OAuth client metadata",
		});
	}
}

async function handleMcpRequest(req: Request, res: Response) {
	const env = getEnv();
	try {
		const context = await verifyAuthorizationHeader({
			authorizationHeader: getHeader(req, "authorization"),
			requestedClientProfile: getHeader(req, "x-mcp-client-profile"),
		});
		const server = createFinMcpServer(context);
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});
		await server.connect(transport);
		await transport.handleRequest(req, res, req.body);
	} catch (error) {
		const normalized = normalizeError(error);
		const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
		const logContext = {
			feature: "mcp",
			operation: "httpRequest",
			statusCode,
			errorCode: normalized.errorCode,
			errorMessage: normalized.errorMessage,
		};
		if (statusCode === 401) {
			logger.warn("MCP HTTP request unauthorized", logContext);
		} else {
			logger.logError("MCP HTTP request failed", error, logContext);
		}
		if (!res.headersSent) {
			if (statusCode === 401) {
				res.setHeader("WWW-Authenticate", getAuthChallenge(env));
			}
			res.status(statusCode).json({
				error: normalized.errorCode ?? "MCP_REQUEST_FAILED",
				message: normalized.errorMessage,
			});
		}
	}
}

export function createHttpApp() {
	const env = getEnv();
	const app = express();
	app.use(express.json({ limit: "1mb" }));
	app.use(express.urlencoded({ extended: false }));

	app.get("/health", (_req, res) => {
		res.json({ ok: true, app: "fin-mcp", transport: "http" });
	});

	app.get(
		[protectedResourcePath, pathSpecificProtectedResourcePath],
		(_req, res) => {
			res.json(getProtectedResourceMetadata(env));
		},
	);

	app.get("/docs/mcp", (_req, res) => {
		res.json(getMcpDocumentation(env));
	});

	app.get("/.well-known/oauth-authorization-server", (_req, res) => {
		const issuer = env.MCP_OAUTH_ISSUER ?? env.MCP_BASE_URL;
		res.json({
			issuer,
			authorization_endpoint: `${env.MCP_BASE_URL}/oauth/authorize`,
			token_endpoint: `${env.MCP_BASE_URL}/oauth/token`,
			revocation_endpoint: `${env.MCP_BASE_URL}/oauth/revoke`,
			registration_endpoint: `${env.MCP_BASE_URL}/oauth/register`,
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code", "refresh_token"],
			code_challenge_methods_supported: ["S256"],
			token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
			scopes_supported: [...mcpScopes],
		});
	});

	app.post("/oauth/register", handleOAuthClientRegistration);

	app.get("/oauth/authorize", async (req, res) => {
		try {
			await assertOAuthRateLimit({
				req,
				operation: "oauthAuthorize",
				limit: 60,
			});
			assertResourceParameter({
				resource:
					typeof req.query.resource === "string"
						? req.query.resource
						: undefined,
				env,
			});
			await getOAuthAuthorizationRequest({
				responseType:
					typeof req.query.response_type === "string"
						? req.query.response_type
						: undefined,
				clientId:
					typeof req.query.client_id === "string"
						? req.query.client_id
						: undefined,
				redirectUri:
					typeof req.query.redirect_uri === "string"
						? req.query.redirect_uri
						: undefined,
				scope:
					typeof req.query.scope === "string" ? req.query.scope : undefined,
				state:
					typeof req.query.state === "string" ? req.query.state : undefined,
				codeChallenge:
					typeof req.query.code_challenge === "string"
						? req.query.code_challenge
						: undefined,
				codeChallengeMethod:
					typeof req.query.code_challenge_method === "string"
						? req.query.code_challenge_method
						: undefined,
			});

			const consentUrl = new URL("/mcp/oauth/authorize", env.WEB_APP_URL);
			for (const [key, value] of Object.entries(req.query)) {
				if (typeof value === "string") consentUrl.searchParams.set(key, value);
			}
			res.redirect(consentUrl.toString());
		} catch (error) {
			const normalized = normalizeError(error);
			const logContext = {
				feature: "mcp",
				operation: "oauthAuthorize",
				errorCode: normalized.errorCode,
				errorMessage: normalized.errorMessage,
			};
			if (error instanceof OAuthRequestError) {
				logger.warn("MCP OAuth authorize request rejected", logContext);
			} else {
				logger.logError(
					"MCP OAuth authorize request failed",
					error,
					logContext,
				);
			}
			res
				.status(getOAuthStatusCode(error))
				.json({ error: getOAuthErrorCode(error, "invalid_request") });
		}
	});

	app.post("/oauth/token", async (req, res) => {
		try {
			await assertOAuthRateLimit({
				req,
				operation: "oauthToken",
				limit: 30,
			});
			assertResourceParameter({
				resource:
					typeof req.body.resource === "string" ? req.body.resource : undefined,
				env,
			});

			if (req.body.grant_type === "authorization_code") {
				const token = await exchangeAuthorizationCode({
					code: String(req.body.code ?? ""),
					clientId: String(req.body.client_id ?? ""),
					clientSecret:
						typeof req.body.client_secret === "string"
							? req.body.client_secret
							: undefined,
					redirectUri: String(req.body.redirect_uri ?? ""),
					codeVerifier: String(req.body.code_verifier ?? ""),
				});
				res.json({
					access_token: token.accessToken,
					refresh_token: token.refreshToken,
					token_type: token.tokenType,
					expires_in: token.expiresIn,
					scope: token.scopes.join(" "),
				});
				return;
			}

			if (req.body.grant_type === "refresh_token") {
				const token = await refreshOAuthAccessToken({
					refreshToken: String(req.body.refresh_token ?? ""),
					clientId: String(req.body.client_id ?? ""),
					clientSecret:
						typeof req.body.client_secret === "string"
							? req.body.client_secret
							: undefined,
				});
				res.json({
					access_token: token.accessToken,
					refresh_token: token.refreshToken,
					token_type: token.tokenType,
					expires_in: token.expiresIn,
					scope: token.scopes.join(" "),
				});
				return;
			}

			if (
				!["authorization_code", "refresh_token"].includes(req.body.grant_type)
			) {
				res.status(400).json({ error: "unsupported_grant_type" });
				return;
			}
		} catch (error) {
			logger.logError("MCP OAuth token exchange failed", error, {
				feature: "mcp",
				operation: "oauthToken",
			});
			res
				.status(getOAuthStatusCode(error))
				.json({ error: getOAuthErrorCode(error, "invalid_grant") });
		}
	});

	app.post("/oauth/revoke", async (req, res) => {
		try {
			await assertOAuthRateLimit({
				req,
				operation: "oauthRevoke",
				limit: 30,
			});
			await revokeOAuthToken({
				token: String(req.body.token ?? ""),
				clientId:
					typeof req.body.client_id === "string"
						? req.body.client_id
						: undefined,
				clientSecret:
					typeof req.body.client_secret === "string"
						? req.body.client_secret
						: undefined,
			});
			res.status(200).json({});
		} catch (error) {
			logger.logError("MCP OAuth token revoke failed", error, {
				feature: "mcp",
				operation: "oauthRevoke",
			});
			res
				.status(getOAuthStatusCode(error))
				.json({ error: getOAuthErrorCode(error, "invalid_request") });
		}
	});

	app.post("/mcp", handleMcpRequest);
	app.get("/mcp", handleMcpRequest);
	return app;
}

function parsePort(value: string | undefined): number | undefined {
	if (!value) return undefined;

	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(`Invalid MCP HTTP port: ${value}`);
	}

	return port;
}

export function getHttpPort() {
	return parsePort(process.env.PORT) ?? getEnv().MCP_PORT;
}

export function logHttpListening(port: number) {
	logger.info("Fin MCP HTTP transport listening", {
		feature: "mcp",
		operation: "startHttp",
		port,
	});
}

export async function startHttpTransport() {
	const app = createHttpApp();
	const port = getHttpPort();
	app.listen(port, () => {
		logHttpListening(port);
	});
}
