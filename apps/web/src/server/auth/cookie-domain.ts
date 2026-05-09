const STARTUP_STATE_COOKIE_DOMAIN = ".startupstateutah.com";

function getConfiguredAuthOrigin(): string | undefined {
	return (
		process.env.AUTH_URL ??
		process.env.NEXTAUTH_URL ??
		process.env.NEXT_PUBLIC_WEB_URL ??
		process.env.VERCEL_PROJECT_PRODUCTION_URL ??
		process.env.VERCEL_URL
	);
}

function getHostname(value: string | undefined): string | null {
	if (!value) return null;
	try {
		return new URL(value.startsWith("http") ? value : `https://${value}`)
			.hostname;
	} catch {
		return null;
	}
}

export function getAuthCookieDomain(): string | undefined {
	if (process.env.NODE_ENV !== "production") return undefined;
	if (process.env.AUTH_COOKIE_DOMAIN) return process.env.AUTH_COOKIE_DOMAIN;

	const hostname = getHostname(getConfiguredAuthOrigin());
	if (!hostname) return undefined;

	if (
		hostname === "startupstateutah.com" ||
		hostname.endsWith(".startupstateutah.com")
	) {
		return STARTUP_STATE_COOKIE_DOMAIN;
	}

	return undefined;
}
