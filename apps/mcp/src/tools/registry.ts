import {
	getMcpToolContract,
	getMcpToolContracts,
	type McpToolName,
} from "@app/mcp-contracts";
import { logToolCall } from "~/audit/log-tool-call";
import {
	assertScopes,
	assertToolAllowedForProfile,
	McpAuthorizationError,
} from "~/auth/scope-checker";
import type { McpAuthContext } from "~/auth/types";
import { checkRateLimit } from "~/rate-limit/rate-limit";
import {
	getCompanyTool,
	getResourceTool,
	recommendResourcesTool,
	searchCompaniesTool,
	searchResourcesTool,
} from "./startup-navigator";
import { getSupportDocumentationTool } from "./support-documentation";
import {
	type McpToolImplementation,
	type McpToolResult,
	toMcpToolResult,
} from "./types";

export class McpToolError extends Error {
	statusCode = 400;
	errorCode = "MCP_TOOL_ERROR";
}

const implementations: Record<McpToolName, McpToolImplementation> = {
	search_resources: searchResourcesTool,
	get_resource: getResourceTool,
	recommend_resources: recommendResourcesTool,
	search_companies: searchCompaniesTool,
	get_company: getCompanyTool,
	get_support_documentation: getSupportDocumentationTool,
};

export function getRegisteredTools(): McpToolImplementation[] {
	return getMcpToolContracts().map(
		(contract) => implementations[contract.name],
	);
}

function isMcpToolName(name: string): name is McpToolName {
	return Boolean(getMcpToolContract(name));
}

function getToolRateLimit(tool: McpToolImplementation): number {
	if (tool.contract.safetyClass === "mutates_app_data") return 20;
	return 60;
}

export async function executeMcpTool(input: {
	name: string;
	arguments: unknown;
	context: McpAuthContext;
}): Promise<McpToolResult> {
	if (!isMcpToolName(input.name)) {
		throw new McpToolError(`Unknown MCP tool: ${input.name}`);
	}

	const tool = implementations[input.name];
	const start = Date.now();
	let parsedInput: unknown = input.arguments ?? {};
	let auditLogged = false;

	try {
		assertToolAllowedForProfile(input.context.clientProfile, input.name);
		assertScopes(input.context.scopes, tool.contract.requiredScopes);

		const rateLimit = await checkRateLimit({
			userId: input.context.userId,
			clientName: input.context.clientName,
			toolName: input.name,
			limit: getToolRateLimit(tool),
		});
		if (!rateLimit.allowed) {
			await logToolCall({
				context: input.context,
				toolName: input.name,
				requiredScopes: tool.contract.requiredScopes,
				toolInput: input.arguments,
				output: {
					limit: rateLimit.limit,
					resetAt: rateLimit.resetAt.toISOString(),
				},
				status: "rate_limited",
				durationMs: Date.now() - start,
				errorCode: "MCP_RATE_LIMITED",
				rateLimited: true,
			});
			auditLogged = true;
			throw new McpAuthorizationError("MCP rate limit exceeded");
		}

		parsedInput = tool.contract.inputSchema.parse(input.arguments ?? {});
		const output = await tool.execute(parsedInput, input.context);
		await logToolCall({
			context: input.context,
			toolName: input.name,
			requiredScopes: tool.contract.requiredScopes,
			toolInput: parsedInput,
			output,
			status: "success",
			durationMs: Date.now() - start,
		});
		return toMcpToolResult(output);
	} catch (error) {
		if (auditLogged) {
			throw error;
		}

		const errorCode =
			error instanceof McpAuthorizationError
				? error.errorCode
				: "MCP_TOOL_ERROR";
		await logToolCall({
			context: input.context,
			toolName: input.name,
			requiredScopes: tool.contract.requiredScopes,
			toolInput: parsedInput,
			output: undefined,
			status: error instanceof McpAuthorizationError ? "denied" : "error",
			durationMs: Date.now() - start,
			errorCode,
		});
		throw error;
	}
}
