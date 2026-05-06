import {
	filterMcpScopes,
	isMcpScope,
	type McpClientProfile,
	type McpScope,
	readScopes,
} from "@app/mcp-contracts";
import type { McpEnv } from "~/config/env";

type RegistrationMetadata = {
	redirectUris: readonly string[];
	clientName?: string;
	clientUri?: string;
	softwareId?: string;
	softwareVersion?: string;
	scope?: string;
};

export type ResolvedOAuthClientRegistration = {
	clientName: string;
	clientProfile: McpClientProfile;
	redirectUris: readonly string[];
	scopes: McpScope[];
	requestsPerMinute: number;
	registrationKind: "loopback" | "hosted";
};

type HostedClientPolicy = {
	profile: McpClientProfile;
	clientName: string;
	redirectHosts: readonly string[];
	allowedScopes: readonly McpScope[];
	defaultScopes: readonly McpScope[];
	requestsPerMinute: number;
	pathAllowed?: (path: string) => boolean;
};

export class OAuthClientRegistrationPolicyError extends Error {
	readonly errorCode = "invalid_client_metadata";
}

function registrationPolicyError(message: string) {
	return new OAuthClientRegistrationPolicyError(message);
}

function parseHostList(value: string | undefined): string[] {
	if (!value?.trim()) return [];
	return value
		.split(",")
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
}

function getHostedClientPolicies(env: McpEnv): HostedClientPolicy[] {
	return [
		{
			profile: "chatgpt",
			clientName: "ChatGPT",
			redirectHosts: parseHostList(
				env.MCP_OAUTH_CHATGPT_REDIRECT_HOSTS ?? "chatgpt.com",
			),
			allowedScopes: readScopes,
			defaultScopes: readScopes,
			requestsPerMinute: 60,
			pathAllowed: (path) =>
				path === "/connector_platform_oauth_redirect" ||
				path.startsWith("/connector/oauth/"),
		},
		{
			profile: "claude",
			clientName: "Claude",
			redirectHosts: parseHostList(env.MCP_OAUTH_CLAUDE_REDIRECT_HOSTS),
			allowedScopes: readScopes,
			defaultScopes: readScopes,
			requestsPerMinute: 60,
		},
		{
			profile: "gemini",
			clientName: "Gemini",
			redirectHosts: parseHostList(env.MCP_OAUTH_GEMINI_REDIRECT_HOSTS),
			allowedScopes: readScopes,
			defaultScopes: readScopes,
			requestsPerMinute: 60,
		},
		{
			profile: "consumer",
			clientName: "Consumer MCP App",
			redirectHosts: parseHostList(env.MCP_OAUTH_CONSUMER_REDIRECT_HOSTS),
			allowedScopes: readScopes,
			defaultScopes: readScopes,
			requestsPerMinute: 30,
		},
	];
}

function parseRequestedScopes(input: {
	scope: string | undefined;
	allowedScopes: readonly McpScope[];
	defaultScopes: readonly McpScope[];
}): McpScope[] {
	if (!input.scope?.trim()) return [...input.defaultScopes];

	const rawScopes = input.scope.split(/\s+/).filter(Boolean);
	const invalidScope = rawScopes.find((value) => !isMcpScope(value));
	if (invalidScope) {
		throw registrationPolicyError(`Unsupported MCP scope: ${invalidScope}`);
	}
	const requestedScopes = filterMcpScopes(rawScopes);

	const allowedScopes = new Set(input.allowedScopes);
	const deniedScope = requestedScopes.find(
		(value) => !allowedScopes.has(value),
	);
	if (deniedScope) {
		throw registrationPolicyError(
			`MCP client is not allowed to request ${deniedScope}`,
		);
	}

	return [...new Set(requestedScopes)];
}

function getMetadataText(input: RegistrationMetadata): string {
	return [
		input.clientName,
		input.clientUri,
		input.softwareId,
		input.softwareVersion,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
}

function inferLoopbackProfile(input: RegistrationMetadata): McpClientProfile {
	const metadataText = getMetadataText(input);
	if (metadataText.includes("cursor")) return "cursor";
	if (metadataText.includes("claude")) return "claude-desktop";
	if (metadataText.includes("codex")) return "codex";
	if (metadataText.includes("openclaw")) return "openclaw";
	return "local-dev";
}

function assertLoopbackRedirectUri(value: string) {
	const url = new URL(value);
	if (url.protocol !== "http:") {
		throw registrationPolicyError("Loopback OAuth redirect URI must use http");
	}
	if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
		throw registrationPolicyError(
			"Loopback OAuth redirect URI must use localhost or 127.0.0.1",
		);
	}
	if (!url.port) {
		throw registrationPolicyError(
			"Loopback OAuth redirect URI must include a callback port",
		);
	}
	if (url.pathname !== "/oauth/callback") {
		throw registrationPolicyError(
			"Loopback OAuth redirect URI must use /oauth/callback",
		);
	}
	if (url.username || url.password || url.search || url.hash) {
		throw registrationPolicyError(
			"Loopback OAuth redirect URI cannot include credentials, query, or hash",
		);
	}
}

function getHostedPolicyForRedirects(input: {
	redirectUris: readonly string[];
	env: McpEnv;
}): HostedClientPolicy | null {
	const urls = input.redirectUris.map((value) => new URL(value));
	const policies = getHostedClientPolicies(input.env).filter(
		(policy) => policy.redirectHosts.length > 0,
	);

	return (
		policies.find((policy) =>
			urls.every((url) => {
				const hostMatches = policy.redirectHosts.includes(
					url.hostname.toLowerCase(),
				);
				const pathMatches = policy.pathAllowed
					? policy.pathAllowed(url.pathname)
					: true;
				return (
					url.protocol === "https:" &&
					hostMatches &&
					pathMatches &&
					!url.username &&
					!url.password &&
					!url.hash
				);
			}),
		) ?? null
	);
}

export function resolveOAuthClientRegistration(input: {
	metadata: RegistrationMetadata;
	env: McpEnv;
}): ResolvedOAuthClientRegistration {
	if (input.metadata.redirectUris.length === 0) {
		throw registrationPolicyError(
			"OAuth client registration requires redirect_uris",
		);
	}

	const loopbackRedirects = input.metadata.redirectUris.every((value) => {
		const url = new URL(value);
		return (
			url.protocol === "http:" &&
			["localhost", "127.0.0.1"].includes(url.hostname)
		);
	});

	if (loopbackRedirects) {
		for (const redirectUri of input.metadata.redirectUris) {
			assertLoopbackRedirectUri(redirectUri);
		}

		return {
			clientName: input.metadata.clientName ?? "MCP Remote",
			clientProfile: inferLoopbackProfile(input.metadata),
			redirectUris: input.metadata.redirectUris,
			scopes: parseRequestedScopes({
				scope: input.metadata.scope,
				allowedScopes: readScopes,
				defaultScopes: readScopes,
			}),
			requestsPerMinute: 60,
			registrationKind: "loopback",
		};
	}

	const hostedPolicy = getHostedPolicyForRedirects({
		redirectUris: input.metadata.redirectUris,
		env: input.env,
	});
	if (!hostedPolicy) {
		throw registrationPolicyError(
			"Hosted OAuth redirect URI is not trusted for dynamic client registration",
		);
	}

	return {
		clientName: input.metadata.clientName ?? hostedPolicy.clientName,
		clientProfile: hostedPolicy.profile,
		redirectUris: input.metadata.redirectUris,
		scopes: parseRequestedScopes({
			scope: input.metadata.scope,
			allowedScopes: hostedPolicy.allowedScopes,
			defaultScopes: hostedPolicy.defaultScopes,
		}),
		requestsPerMinute: hostedPolicy.requestsPerMinute,
		registrationKind: "hosted",
	};
}
