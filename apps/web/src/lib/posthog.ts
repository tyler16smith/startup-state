"use client";

import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
	if (initialized || typeof window === "undefined") return;

	const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
	if (!key) {
		// Skip initialization in development if key is not set
		if (process.env.NODE_ENV === "development") {
			console.warn("PostHog key not set, skipping initialization");
		}
		return;
	}

	posthog.init(key, {
		api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
		capture_pageview: false, // we manually control this
		persistence: "localStorage",
	});

	initialized = true;
}

export function isPostHogInitialized() {
	return initialized;
}

export { posthog };
