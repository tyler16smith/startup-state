import {
	getExtensionState,
	setAuthState,
	setHelloWorldResult,
} from "./chrome-storage";
import type { AuthState, HelloWorldResult } from "./types";

const env = import.meta.env as Record<string, string | undefined>;
const apiBaseUrl = (env.WXT_APP_API_URL ?? "http://localhost:3001").replace(
	/\/$/,
	"",
);
const webBaseUrl = (env.WXT_APP_WEB_URL ?? "http://localhost:3000").replace(
	/\/$/,
	"",
);

type ApiEnvelope<T> = { data: T } | { error: { message: string } };

type ApiRequestOptions = RequestInit & {
	auth?: boolean;
	retryOnUnauthorized?: boolean;
};

export type ExtensionAccountProfile = {
	user: {
		id: string;
		email: string;
	};
};

function createRequestId(): string {
	return `api_${crypto.randomUUID()}`;
}

async function readApiEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
	const text = await response.text();
	if (!text) return { data: undefined as T };

	try {
		return JSON.parse(text) as ApiEnvelope<T>;
	} catch {
		return { error: { message: "The API returned an invalid response" } };
	}
}

function isExpiringSoon(auth: NonNullable<AuthState>): boolean {
	return new Date(auth.expiresAt).getTime() <= Date.now() + 60_000;
}

async function refreshAuthState(
	auth: NonNullable<AuthState>,
): Promise<NonNullable<AuthState>> {
	if (!auth.refreshToken) throw new Error("No refresh token available");

	const result = await apiRequest<{
		accessToken: string;
		expiresIn: number;
		tokenType: string;
		user?: {
			id: string;
			email: string;
		};
	}>("/api/v1/extensionAuth/refresh", {
		method: "POST",
		body: JSON.stringify({ refreshToken: auth.refreshToken }),
		auth: false,
		retryOnUnauthorized: false,
	});

	const nextAuth = {
		...auth,
		appUserId: result.user?.id ?? auth.appUserId,
		email: result.user?.email ?? auth.email,
		accessToken: result.accessToken,
		expiresAt: new Date(Date.now() + result.expiresIn * 1000).toISOString(),
	};
	await setAuthState(nextAuth);
	return nextAuth;
}

async function apiRequest<T>(
	path: string,
	options: ApiRequestOptions = {},
): Promise<T> {
	const requestId = createRequestId();
	const state = await getExtensionState();
	const headers = new Headers(options.headers);
	headers.set("Content-Type", "application/json");
	const shouldAttachAuth = options.auth !== false;
	let auth = state.auth;
	const url = `${apiBaseUrl}${path}`;

	if (shouldAttachAuth && auth?.refreshToken && isExpiringSoon(auth)) {
		auth = await refreshAuthState(auth).catch(async (error: unknown) => {
			await setAuthState(null);
			throw error;
		});
	}

	if (shouldAttachAuth && auth?.accessToken) {
		headers.set("Authorization", `Bearer ${auth.accessToken}`);
	}

	const response = await fetch(url, { ...options, headers });
	const envelope = await readApiEnvelope<T>(response);

	if (
		response.status === 401 &&
		options.retryOnUnauthorized !== false &&
		shouldAttachAuth &&
		auth?.refreshToken
	) {
		const refreshedAuth = await refreshAuthState(auth).catch(async (error) => {
			await setAuthState(null);
			throw error;
		});
		const retryHeaders = new Headers(options.headers);
		retryHeaders.set("Content-Type", "application/json");
		retryHeaders.set("Authorization", `Bearer ${refreshedAuth.accessToken}`);

		const retryResponse = await fetch(url, {
			...options,
			headers: retryHeaders,
		});
		const retryEnvelope = await readApiEnvelope<T>(retryResponse);
		if (!retryResponse.ok || "error" in retryEnvelope) {
			throw new Error(
				"error" in retryEnvelope
					? retryEnvelope.error.message
					: `API request ${requestId} failed`,
			);
		}

		return retryEnvelope.data;
	}

	if (!response.ok || "error" in envelope) {
		throw new Error(
			"error" in envelope
				? envelope.error.message
				: `API request ${requestId} failed`,
		);
	}

	return envelope.data;
}

export function getAppWebUrl(path = "/"): string {
	return `${webBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function startAppAuth(): Promise<void> {
	const extensionId = chrome.runtime.id;
	const authUrl = getAppWebUrl(
		`/extension/auth?extensionId=${encodeURIComponent(extensionId)}`,
	);
	await chrome.tabs.create({ url: authUrl, active: true });
}

export async function refreshAppAuth(): Promise<void> {
	const state = await getExtensionState();
	if (!state.auth) throw new Error("No auth session available");
	await refreshAuthState(state.auth);
}

export async function getExtensionAccount(): Promise<ExtensionAccountProfile> {
	return apiRequest<ExtensionAccountProfile>("/api/v1/extensionAuth/me");
}

export async function syncExtensionAccount(): Promise<ExtensionAccountProfile> {
	const account = await getExtensionAccount();
	const state = await getExtensionState();

	if (state.auth) {
		const nextAuth = {
			...state.auth,
			appUserId: account.user.id,
			email: account.user.email,
		};

		if (
			nextAuth.appUserId !== state.auth.appUserId ||
			nextAuth.email !== state.auth.email
		) {
			await setAuthState(nextAuth);
		}
	}

	return account;
}

export async function revokeAppAuth(): Promise<void> {
	try {
		await apiRequest<{ message: string }>("/api/v1/extensionAuth/revoke", {
			method: "POST",
			body: JSON.stringify({ allDevices: false }),
		});
	} finally {
		await setAuthState(null);
	}
}

export async function requestHelloWorld(): Promise<HelloWorldResult> {
	const result = await apiRequest<HelloWorldResult>(
		"/api/v1/extension/helloWorld",
	);
	await setHelloWorldResult(result);
	return result;
}
