function getApiBaseUrl(): string {
	const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(
		/\/$/,
		"",
	);
	if (!configuredApiBaseUrl) {
		throw new Error("NEXT_PUBLIC_API_URL must be set");
	}
	return configuredApiBaseUrl;
}

const configuredMcpBaseUrl = process.env.NEXT_PUBLIC_MCP_URL?.replace(
	/\/$/,
	"",
);

export function getMcpBaseUrl(): string {
	if (!configuredMcpBaseUrl) {
		throw new Error("NEXT_PUBLIC_MCP_URL must be set");
	}
	return configuredMcpBaseUrl;
}

export function toMcpUrl(path: string): string {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return `${getMcpBaseUrl()}${normalizedPath}`;
}

export function toApiUrl(path: string): string {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return `${getApiBaseUrl()}${normalizedPath}`;
}
