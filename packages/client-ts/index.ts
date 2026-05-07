/**
 * API Client Configuration and Re-exports
 *
 * This module sets up the API client for use in web and native applications.
 * Configure the base URL via NEXT_PUBLIC_API_URL environment variable.
 */

export * from "./src/index";
export { getCsrfToken, clearCsrfToken } from "./api-client";

import type { listTransactionCategoriesResponse } from "./src/index";

// Configuration helpers
export function getApiBaseUrl(): string {
	const isDevelopment = process.env.NODE_ENV === "development";
	const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;

	// Browser context
	if (typeof window !== "undefined") {
		// In development, use relative URLs (proxied through Next.js)
		// In production, use configured API URL.
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
			"API_URL not set. Set NEXT_PUBLIC_API_URL or API_URL environment variable.",
		);
	}
	return baseUrl || "";
}

/**
 * Helper to create fetch with proper base URL and credentials
 */
export function createApiRequest(
	_endpoint: string,
	options?: RequestInit,
): RequestInit {
	return {
		...options,
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
		credentials: "include", // Include cookies for session auth
	};
}

export async function listTransactionCategoriesFromApi(
	options?: RequestInit,
): Promise<listTransactionCategoriesResponse> {
	const baseUrl = getApiBaseUrl();
	const res = await fetch(`${baseUrl}/api/v1/transaction/listCategories`, {
		...options,
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			...options?.headers,
		},
		credentials: "include",
	});
	const data = await res.json();
	return { status: res.status, data };
}
