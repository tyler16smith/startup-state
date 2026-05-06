export const mcpScopes = ["mcp:read"] as const;

export type McpScope = (typeof mcpScopes)[number];

export const readScopes = ["mcp:read"] as const satisfies readonly McpScope[];

export function isMcpScope(scope: string): scope is McpScope {
	return (mcpScopes as readonly string[]).includes(scope);
}

export function filterMcpScopes(scopes: readonly string[]): McpScope[] {
	return scopes.filter(isMcpScope);
}

export function hasRequiredScopes(
	grantedScopes: readonly string[],
	requiredScopes: readonly McpScope[],
): boolean {
	const granted = new Set(grantedScopes);
	return requiredScopes.every((scope) => granted.has(scope));
}
