import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthContext } from "~/auth/types";
import { executeMcpTool, getRegisteredTools } from "~/tools/registry";
import type { McpToolImplementation } from "~/tools/types";

function getToolAnnotations(tool: McpToolImplementation): ToolAnnotations {
	const isReadOnly = tool.contract.safetyClass === "read_only_app_data";
	return {
		title: tool.contract.title,
		readOnlyHint: isReadOnly,
		destructiveHint: tool.contract.safetyClass === "mutates_user_data",
		idempotentHint: isReadOnly,
		openWorldHint: false,
	};
}

function getToolMeta(tool: McpToolImplementation): Record<string, unknown> {
	const securitySchemes = [
		{
			type: "oauth2",
			scopes: [...tool.contract.requiredScopes],
		},
	];

	return {
		securitySchemes,
		"openai/toolInvocation/invoking": tool.contract.requiresConfirmation
			? "Awaiting approval..."
			: "Working...",
		"openai/toolInvocation/invoked": tool.contract.requiresConfirmation
			? "Action complete"
			: "Done",
	};
}

export function createFinMcpServer(context: McpAuthContext): McpServer {
	const server = new McpServer({
		name: "app-mcp-gateway",
		version: "0.1.0",
	});

	for (const tool of getRegisteredTools()) {
		server.registerTool(
			tool.contract.name,
			{
				title: tool.contract.title,
				description: tool.contract.description,
				inputSchema: tool.contract.inputSchema,
				annotations: getToolAnnotations(tool),
				_meta: getToolMeta(tool),
			},
			async (args: unknown) =>
				executeMcpTool({
					name: tool.contract.name,
					arguments: args,
					context,
				}),
		);
	}

	return server;
}
