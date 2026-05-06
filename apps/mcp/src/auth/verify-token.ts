import { defaultClientProfile } from "@app/mcp-contracts";
import { db } from "~/lib/db";
import { validateOAuthAccessToken } from "./oauth-service";
import { validatePersonalAccessToken } from "./pat-service";
import { resolveClientProfile } from "./scope-checker";
import { getBearerToken } from "./token-hash";
import type { McpAuthContext } from "./types";

export class McpAuthenticationError extends Error {
	statusCode = 401;
	errorCode = "MCP_UNAUTHORIZED";

	constructor(message = "Unauthorized MCP request") {
		super(message);
	}
}

export async function verifyAuthorizationHeader(input: {
	authorizationHeader: string | undefined;
	requestedClientProfile?: string | null;
}): Promise<McpAuthContext> {
	let token: string;
	try {
		token = getBearerToken(input.authorizationHeader);
	} catch {
		throw new McpAuthenticationError("Missing or invalid MCP bearer token");
	}
	if (!token) {
		throw new McpAuthenticationError("Missing or invalid MCP bearer token");
	}

	const pat = await validatePersonalAccessToken(token);
	if (pat) {
		return {
			db,
			authKind: "pat",
			userId: pat.userId,
			clientName: pat.clientName ?? pat.name,
			clientProfile: resolveClientProfile(input.requestedClientProfile),
			personalAccessTokenId: pat.id,
			scopes: pat.scopes,
		};
	}

	const oauth = await validateOAuthAccessToken(token);
	if (oauth) {
		return {
			db,
			authKind: "oauth",
			userId: oauth.userId,
			clientId: oauth.clientId,
			clientName: oauth.clientName,
			clientProfile: oauth.clientProfile ?? defaultClientProfile,
			oauthAccessTokenId: oauth.id,
			oauthClientId: oauth.oauthClientId,
			scopes: oauth.scopes,
		};
	}

	throw new McpAuthenticationError();
}
