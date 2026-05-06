import { getCsrfToken } from "@app/client-ts";
import type { McpClientProfile, McpScope } from "@app/mcp-contracts";
import { toApiUrl } from "~/lib/api-url";

type ApiEnvelope<T> = { data: T };

type ApiResponse<T> = {
	status: number;
	data: ApiEnvelope<T> | { error?: { message?: string } };
};

export type McpPersonalAccessToken = {
	id: string;
	name: string;
	tokenPrefix: string;
	scopes: McpScope[];
	clientName: string | null;
	expiresAt: string | null;
	revokedAt: string | null;
	lastUsedAt: string | null;
	createdAt: string;
};

export type CreatedMcpPersonalAccessToken = Omit<
	McpPersonalAccessToken,
	"revokedAt" | "lastUsedAt"
> & {
	token: string;
};

export type McpOAuthConnection = {
	id: string;
	tokenPrefix: string;
	scopes: McpScope[];
	expiresAt: string;
	refreshTokenExpiresAt: string | null;
	revokedAt: string | null;
	lastUsedAt: string | null;
	createdAt: string;
	oauthClient: {
		clientId: string;
		name: string;
		clientProfile: string;
	};
};

export type OAuthConsentRequest = {
	client: {
		clientId: string;
		name: string;
		clientProfile: McpClientProfile;
	};
	redirectUri: string;
	scopes: McpScope[];
	state: string | null;
};

export type OAuthConsentInput = {
	response_type: "code";
	client_id: string;
	redirect_uri: string;
	scope?: string;
	state?: string;
	code_challenge: string;
	code_challenge_method: "S256";
};

function isSuccess<T>(response: ApiResponse<T>): response is {
	status: number;
	data: ApiEnvelope<T>;
} {
	return (
		response.status >= 200 && response.status < 300 && "data" in response.data
	);
}

function errorMessage(
	response: ApiResponse<unknown>,
	fallback: string,
): string {
	if ("error" in response.data) {
		return response.data.error?.message ?? fallback;
	}
	return fallback;
}

async function request<T>(
	path: string,
	options: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
	const method = options.method ?? "GET";
	const csrfToken = method === "POST" ? await getCsrfToken() : null;
	const response = await fetch(toApiUrl(path), {
		method,
		credentials: "include",
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
	});
	const data = (await response.json()) as ApiResponse<T>["data"];
	const wrapped = { status: response.status, data } satisfies ApiResponse<T>;
	if (!isSuccess(wrapped)) {
		throw new Error(errorMessage(wrapped, "MCP request failed"));
	}
	return wrapped.data.data;
}

export function listMcpPersonalAccessTokens() {
	return request<{ tokens: McpPersonalAccessToken[] }>(
		"/api/v1/mcp/listPersonalAccessTokens",
	);
}

export function createMcpPersonalAccessToken(input: {
	name: string;
	clientName?: string;
	clientProfile?: McpClientProfile;
	scopes: McpScope[];
	expiresInDays?: number | null;
}) {
	return request<{ token: CreatedMcpPersonalAccessToken }>(
		"/api/v1/mcp/createPersonalAccessToken",
		{ method: "POST", body: input },
	);
}

export function revokeMcpPersonalAccessToken(input: { tokenId: string }) {
	return request<{ success: boolean }>(
		"/api/v1/mcp/revokePersonalAccessToken",
		{ method: "POST", body: input },
	);
}

export function listMcpOAuthConnections() {
	return request<{ connections: McpOAuthConnection[] }>(
		"/api/v1/mcp/listOAuthConnections",
	);
}

export function revokeMcpOAuthConnection(input: { accessTokenId: string }) {
	return request<{ success: boolean }>("/api/v1/mcp/revokeOAuthConnection", {
		method: "POST",
		body: input,
	});
}

export function getMcpOAuthConsentRequest(input: OAuthConsentInput) {
	return request<OAuthConsentRequest>("/api/v1/mcp/getOAuthConsentRequest", {
		method: "POST",
		body: input,
	});
}

export function approveMcpOAuthConsent(input: OAuthConsentInput) {
	return request<{ redirectUrl: string; expiresAt: string }>(
		"/api/v1/mcp/approveOAuthConsent",
		{ method: "POST", body: input },
	);
}
