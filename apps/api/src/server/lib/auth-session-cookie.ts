const sessionCookieNames = [
	"__Secure-authjs.session-token",
	"authjs.session-token",
] as const;

export function parseCookieHeader(
	cookieHeader: string,
): Record<string, string> {
	const cookies: Record<string, string> = {};
	for (const part of cookieHeader.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key) cookies[key.trim()] = decodeURIComponent(rest.join("=").trim());
	}
	return cookies;
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getChunkedCookieValue(
	cookies: Record<string, string>,
	name: string,
): string | null {
	if (cookies[name]) return cookies[name];

	const chunks = getCookieChunks(cookies, name);

	return chunks.length > 0 ? chunks.map((chunk) => chunk.value).join("") : null;
}

function getCookieChunks(cookies: Record<string, string>, name: string) {
	return Object.entries(cookies)
		.map(([key, value]) => {
			const match = key.match(new RegExp(`^${escapeRegExp(name)}\\.(\\d+)$`));
			return match ? { index: Number(match[1]), value } : null;
		})
		.filter(
			(chunk): chunk is { index: number; value: string } => chunk !== null,
		)
		.sort((left, right) => left.index - right.index);
}

export function extractSessionCookie(cookies: Record<string, string>): {
	token: string;
	salt: string;
} | null {
	for (const name of sessionCookieNames) {
		const token = getChunkedCookieValue(cookies, name);
		if (token) return { token, salt: name };
	}

	return null;
}
