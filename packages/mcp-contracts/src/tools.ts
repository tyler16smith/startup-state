import type { z } from "zod";
import { emptyInputSchema } from "./schemas";
import type { McpScope } from "./scopes";

export const mcpToolNames = ["mcp.get_profile"] as const;

export type McpToolName = (typeof mcpToolNames)[number];

export type McpToolSafetyClass =
	| "read_only_app_data"
	| "mutates_app_data"
	| "mutates_user_data";

export type McpToolContract = {
	name: McpToolName;
	title: string;
	description: string;
	inputSchema: z.ZodTypeAny;
	requiredScopes: readonly McpScope[];
	safetyClass: McpToolSafetyClass;
	requiresConfirmation: boolean;
	widgetReady: boolean;
};

export const mcpToolContracts = {
	"mcp.get_profile": {
		name: "mcp.get_profile",
		title: "Get profile",
		description: "Return basic profile info for the authenticated user.",
		inputSchema: emptyInputSchema,
		requiredScopes: ["mcp:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
} as const satisfies Record<McpToolName, McpToolContract>;

export function getMcpToolContract(name: string): McpToolContract | undefined {
	if (!(mcpToolNames as readonly string[]).includes(name)) return undefined;
	return mcpToolContracts[name as McpToolName];
}

export function getMcpToolContracts(): McpToolContract[] {
	return mcpToolNames.map((name) => mcpToolContracts[name]);
}
