import crypto from "node:crypto";
import { decode } from "next-auth/jwt";

/**
 * Parse a raw Cookie header string into a key-value map.
 * Values are URL-decoded.
 */
function parseCookieHeader(cookieHeader: string): Record<string, string> {
	const cookies: Record<string, string> = {};
	for (const part of cookieHeader.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key) cookies[key.trim()] = decodeURIComponent(rest.join("=").trim());
	}
	return cookies;
}

/**
 * Extract the raw NextAuth session token string from a Cookie header.
 * Prefers __Secure- prefix (production) over plain (dev).
 */
export function extractSessionToken(cookieHeader: string): string | null {
	const cookies = parseCookieHeader(cookieHeader);
	return (
		cookies["__Secure-authjs.session-token"] ??
		cookies["authjs.session-token"] ??
		null
	);
}

/**
 * Extract the stable session identity from a NextAuth JWT cookie value.
 *
 * Auth.js v5 uses encrypted JWTs (JWE), so we must use decode() to properly
 * decrypt and extract `sub` (userId). We use only `sub` and not `iat` because
 * Auth.js v5 updates `iat` on every JWT rotation — using it would cause CSRF
 * tokens computed before and after a rotation to differ.
 */
async function extractStableSessionKey(
	sessionToken: string,
	salt: string,
): Promise<string> {
	try {
		const secret = process.env.AUTH_SECRET;
		if (!secret) return sessionToken;
		const decoded = await decode({ token: sessionToken, secret, salt });
		if (decoded?.sub) {
			// Use only sub (userId). iat is NOT stable in Auth.js v5 — it is
			// updated on every JWT rotation, causing token mismatches.
			return decoded.sub;
		}
	} catch {
		// fall through to raw token as fallback
	}
	return sessionToken;
}

/**
 * Derive a per-session CSRF token via HMAC-SHA256.
 *
 * The token is bound to the userId (`sub`) extracted from the session JWT so
 * it remains stable across Auth.js v5 JWT rotations (which update `iat` and
 * `exp`) and cannot be forged without knowing AUTH_SECRET.
 * - Cannot be forged without knowing AUTH_SECRET
 * - Does not require additional storage
 *
 * Pass the full raw Cookie header so the correct JWE salt (cookie name) can
 * be determined automatically.
 */
export async function computeCsrfToken(cookieHeader: string): Promise<string> {
	const secret = process.env.AUTH_SECRET;
	if (!secret) throw new Error("AUTH_SECRET not configured");

	const cookies = parseCookieHeader(cookieHeader);
	const isSecure = "__Secure-authjs.session-token" in cookies;
	const salt = isSecure
		? "__Secure-authjs.session-token"
		: "authjs.session-token";
	const sessionToken =
		cookies["__Secure-authjs.session-token"] ?? cookies["authjs.session-token"];

	if (!sessionToken)
		throw new Error("CSRF validation failed: no active session");

	const stableKey = await extractStableSessionKey(sessionToken, salt);
	return crypto.createHmac("sha256", secret).update(stableKey).digest("hex");
}
