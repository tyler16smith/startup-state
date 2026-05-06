import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { verifyAuthorizationHeader } from "~/auth/verify-token";
import { createFinMcpServer } from "~/mcp-server";

export async function startStdioTransport() {
	if (!process.env.FIN_MCP_TOKEN) {
		throw new Error("FIN_MCP_TOKEN is required for MCP stdio transport");
	}

	const context = await verifyAuthorizationHeader({
		authorizationHeader: `Bearer ${process.env.FIN_MCP_TOKEN}`,
		requestedClientProfile: process.env.FIN_MCP_CLIENT_PROFILE ?? "local-dev",
	});
	const server = createFinMcpServer(context);
	const transport = new StdioServerTransport();
	await server.connect(transport);
}
