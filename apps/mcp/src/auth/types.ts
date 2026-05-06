import type { McpClientProfile, McpScope } from "@app/mcp-contracts";
import type { DbClient } from "~/lib/db";

export type McpAuthKind = "pat" | "oauth";

export type McpAuthContext = {
	db: DbClient;
	authKind: McpAuthKind;
	userId: string;
	householdId?: string;
	clientId?: string;
	clientName?: string;
	clientProfile: McpClientProfile;
	personalAccessTokenId?: string;
	oauthAccessTokenId?: string;
	oauthClientId?: string;
	scopes: McpScope[];
};
