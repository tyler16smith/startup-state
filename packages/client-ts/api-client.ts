/**
 * Custom fetch wrapper for Orval-generated API client
 * Handles base URL resolution and credentials
 *
 * Web: Uses HttpOnly session cookies (via credentials: "include")
 * Mobile: Will use Bearer tokens (added by mobile app layer)
 */

function getApiBaseUrl(): string {
	const isDevelopment = process.env.NODE_ENV === "development";
	const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;

	// Browser context
	if (typeof window !== "undefined") {
		// In development, use relative URLs (proxied through Next.js)
		// In production, use configured API URL
		if (isDevelopment) {
			return "";
		}
		if (publicApiUrl) {
			return publicApiUrl;
		}
		return window.location.origin;
	}

	// Server-side (SSR) - always use full URL
	if (publicApiUrl) {
		return publicApiUrl;
	}

	const baseUrl = process.env.API_URL;
	if (!baseUrl) {
		console.warn(
			"[API Client] API_URL not set. Set NEXT_PUBLIC_API_URL or API_URL environment variable.",
		);
	}
	return baseUrl || "";
}

// ─── Per-Session CSRF Token ───────────────────────────────────────────────────

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hasRequestBody(options: RequestInit | undefined): boolean {
	return options?.body !== undefined && options.body !== null;
}

let cachedCsrfToken: string | null = null;
let csrfTokenFetched = false;

type CsrfTokenFetchResult =
	| { ok: true; token: string | null }
	| { ok: false; token: null };

async function fetchCsrfToken(): Promise<CsrfTokenFetchResult> {
	if (typeof window === "undefined") return { ok: false, token: null };
	try {
		const baseUrl = getApiBaseUrl();
		const response = await fetch(`${baseUrl}/api/v1/auth/csrfToken`, {
			method: "GET",
			credentials: "include",
		});
		if (!response.ok) return { ok: false, token: null };
		const payload = (await response.json()) as {
			data?: { csrfToken?: string };
		};
		return { ok: true, token: payload?.data?.csrfToken ?? null };
	} catch {
		return { ok: false, token: null };
	}
}

/**
 * Return the per-session CSRF token, fetching and caching it on first call.
 * Safe to call from any browser context; returns null during SSR.
 */
export async function getCsrfToken(): Promise<string | null> {
	if (typeof window === "undefined") return null;
	if (!csrfTokenFetched) {
		const result = await fetchCsrfToken();
		if (result.ok) {
			cachedCsrfToken = result.token;
			csrfTokenFetched = true;
		}
	}
	return cachedCsrfToken;
}

/**
 * Invalidate the cached CSRF token (call after sign-out or session rotation).
 */
export function clearCsrfToken(): void {
	cachedCsrfToken = null;
	csrfTokenFetched = false;
}

function isInvalidCsrfResponse(data: unknown): boolean {
	if (typeof data !== "object" || data === null || !("error" in data)) {
		return false;
	}
	const error = (data as { error?: unknown }).error;
	if (typeof error !== "object" || error === null || !("message" in error)) {
		return false;
	}
	return (error as { message?: unknown }).message === "Invalid CSRF token";
}

// ─── Core Fetch ───────────────────────────────────────────────────────────────

export const customFetch = async <T>(
	url: string,
	options?: RequestInit,
): Promise<T> => {
	const baseUrl = getApiBaseUrl();
	const fullUrl = `${baseUrl}${url}`;
	const method = (
		(options?.method as string | undefined) ?? "GET"
	).toUpperCase();

	const buildHeaders = async () => {
		const csrfHeaders: Record<string, string> = {};
		if (UNSAFE_METHODS.has(method) && typeof window !== "undefined") {
			const token = await getCsrfToken();
			if (token) csrfHeaders["x-csrf-token"] = token;
		}

		return {
			...(hasRequestBody(options)
				? { "Content-Type": "application/json" }
				: {}),
			...csrfHeaders,
			...options?.headers,
		};
	};

	const fetchWithCurrentCsrfToken = async () => {
		return fetch(fullUrl, {
			...options,
			headers: await buildHeaders(),
			credentials: "include", // Send HttpOnly session cookies
		});
	};

	let response = await fetchWithCurrentCsrfToken();
	let data = await response.json();

	if (response.status === 403 && isInvalidCsrfResponse(data)) {
		clearCsrfToken();
		response = await fetchWithCurrentCsrfToken();
		data = await response.json();
	}

	return { status: response.status, data } as T;
};

export default customFetch;
