import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { applyCorsHeaders, enforceOrigin, getAllowedOrigins } from "./cors";

type HeaderValue = number | string | readonly string[];

const ORIGINAL_ENV = {
	CORS_ORIGINS: process.env.CORS_ORIGINS,
	NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
	NODE_ENV: process.env.NODE_ENV,
	WEB_ORIGIN: process.env.WEB_ORIGIN,
};

function restoreEnv() {
	for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

function setEnv(values: Record<string, string | undefined>) {
	for (const [key, value] of Object.entries(values)) {
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

function createMockResponse() {
	const headers = new Map<string, HeaderValue>();
	const response = {
		setHeader(headerName: string, value: HeaderValue) {
			headers.set(headerName.toLowerCase(), value);
			return response;
		},
	};

	return { headers, response };
}

afterEach(() => {
	restoreEnv();
});

describe("API CORS policy", () => {
	it("includes the deployed web origin by default", () => {
		setEnv({
			CORS_ORIGINS: undefined,
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "production",
			WEB_ORIGIN: undefined,
		});

		assert.ok(
			getAllowedOrigins().includes("https://utah-hackathon-web.vercel.app"),
		);
	});

	it("sets credentialed CORS headers for a configured production app origin", () => {
		setEnv({
			CORS_ORIGINS: undefined,
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "production",
			WEB_ORIGIN: "https://app.example.com",
		});
		const origin = "https://app.example.com";
		const request = { headers: { origin } };
		const { headers, response } = createMockResponse();

		const result = applyCorsHeaders(
			request as Parameters<typeof applyCorsHeaders>[0],
			response as Parameters<typeof applyCorsHeaders>[1],
			"GET,OPTIONS",
		);

		assert.equal(result.isAllowedOrigin, true);
		assert.equal(headers.get("access-control-allow-origin"), origin);
		assert.equal(headers.get("access-control-allow-credentials"), "true");
		assert.equal(headers.get("access-control-allow-methods"), "GET,OPTIONS");
		assert.match(
			String(headers.get("access-control-allow-headers")),
			/X-CSRF-Token/,
		);
		assert.equal(headers.get("vary"), "Origin");
	});

	it("does not emit allow-origin for untrusted browser origins", () => {
		setEnv({
			CORS_ORIGINS: undefined,
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "production",
			WEB_ORIGIN: undefined,
		});
		const request = { headers: { origin: "https://evil.example" } };
		const { headers, response } = createMockResponse();

		const result = applyCorsHeaders(
			request as Parameters<typeof applyCorsHeaders>[0],
			response as Parameters<typeof applyCorsHeaders>[1],
		);

		assert.equal(result.isAllowedOrigin, false);
		assert.equal(headers.has("access-control-allow-origin"), false);
		assert.throws(
			() =>
				enforceOrigin(
					request as Parameters<typeof enforceOrigin>[0],
					result.allowedOrigins,
				),
			/Origin not allowed/,
		);
	});

	it("adds localhost variants outside production", () => {
		setEnv({
			CORS_ORIGINS: "http://localhost:3000",
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "development",
			WEB_ORIGIN: undefined,
		});

		assert.deepEqual(
			getAllowedOrigins().filter((origin) => origin.includes("3000")),
			["http://localhost:3000", "http://127.0.0.1:3000"],
		);
	});

	it("allows local web origins in production for deployed API testing", () => {
		setEnv({
			CORS_ORIGINS: undefined,
			NEXT_PUBLIC_WEB_URL: undefined,
			NODE_ENV: "production",
			WEB_ORIGIN: undefined,
		});

		assert.ok(getAllowedOrigins().includes("http://localhost:3000"));
		assert.ok(getAllowedOrigins().includes("http://127.0.0.1:3000"));
	});
});
