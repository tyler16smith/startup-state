import type { z } from "zod";
import {
	mcpGetByIdOrSlugInputSchema,
	mcpRecommendResourcesInputSchema,
	mcpSearchCompaniesInputSchema,
	mcpSearchResourcesInputSchema,
	supportDocumentationInputSchema,
} from "./schemas";
import type { McpScope } from "./scopes";

export const mcpToolNames = [
	"search_resources",
	"get_resource",
	"recommend_resources",
	"search_companies",
	"get_company",
	"get_support_documentation",
] as const;

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
	search_resources: {
		name: "search_resources",
		title: "Search resources",
		description:
			"Search published startup resources by keyword, founder stage, sector, goal, region, and business type.",
		inputSchema: mcpSearchResourcesInputSchema,
		requiredScopes: ["mcp:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	get_resource: {
		name: "get_resource",
		title: "Get resource",
		description: "Fetch one published startup resource by id or slug.",
		inputSchema: mcpGetByIdOrSlugInputSchema,
		requiredScopes: ["mcp:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	recommend_resources: {
		name: "recommend_resources",
		title: "Recommend resources",
		description:
			"Recommend published startup resources for a founder profile using stage, sector, goals, funding needs, business type, region, and keywords.",
		inputSchema: mcpRecommendResourcesInputSchema,
		requiredScopes: ["mcp:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	search_companies: {
		name: "search_companies",
		title: "Search companies",
		description:
			"Search published company profiles by keyword, sector, stage, hiring status, employee range, city, or county.",
		inputSchema: mcpSearchCompaniesInputSchema,
		requiredScopes: ["mcp:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	get_company: {
		name: "get_company",
		title: "Get company",
		description: "Fetch one published company profile by id or slug.",
		inputSchema: mcpGetByIdOrSlugInputSchema,
		requiredScopes: ["mcp:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	get_support_documentation: {
		name: "get_support_documentation",
		title: "Get support documentation",
		description:
			"Return concise support documentation that helps users navigate and use Startup State Navigator.",
		inputSchema: supportDocumentationInputSchema,
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
