import { parseCookieHeader } from "./auth-session-cookie";

function hasChunkedCookie(
	cookies: Record<string, string>,
	name: string,
): boolean {
	return Object.keys(cookies).some((key) => key.startsWith(`${name}.`));
}

export function getSessionCookieDiagnostics(cookieHeader: string | undefined) {
	const cookies = parseCookieHeader(cookieHeader ?? "");
	const cookieNames = Object.keys(cookies);
	const secureSessionCookie = "__Secure-authjs.session-token";
	const plainSessionCookie = "authjs.session-token";

	return {
		hasCookieHeader: Boolean(cookieHeader),
		cookieCount: cookieNames.length,
		hasSecureSessionCookie: Boolean(cookies[secureSessionCookie]),
		hasPlainSessionCookie: Boolean(cookies[plainSessionCookie]),
		hasChunkedSecureSessionCookie: hasChunkedCookie(
			cookies,
			secureSessionCookie,
		),
		hasChunkedPlainSessionCookie: hasChunkedCookie(cookies, plainSessionCookie),
	};
}
