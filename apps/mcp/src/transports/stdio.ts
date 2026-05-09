import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { verifyAuthorizationHeader } from "~/auth/verify-token";
import { createFinMcpServer } from "~/mcp-server";

function getStdioToken() {
	const token =
		process.env.STARTUP_STATE_MCP_TOKEN ?? process.env.FIN_MCP_TOKEN;
	if (!token) {
		throw new Error(
			"STARTUP_STATE_MCP_TOKEN is required for MCP stdio transport",
		);
	}

	return token;
}

export async function startStdioTransport() {
	const token = getStdioToken();

	const context = await verifyAuthorizationHeader({
		authorizationHeader: `Bearer ${token}`,
		requestedClientProfile:
			process.env.STARTUP_STATE_MCP_CLIENT_PROFILE ??
			process.env.FIN_MCP_CLIENT_PROFILE ??
			"local-dev",
	});
	const server = createFinMcpServer(context);
	const transport = new StdioServerTransport();
	await server.connect(transport);
}
