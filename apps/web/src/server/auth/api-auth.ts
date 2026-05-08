import { logger } from "~/lib/logger";
import type { UserRole } from "~/lib/user-role";
import { getServerApiBaseUrl } from "~/server/api-url";

type WebAuthUser = {
	id: string;
	email: string | null;
	name: string | null;
	image: string | null;
	role: UserRole;
	twoFactorEnabled: boolean;
};

type WebAuthUserMinimal = {
	id: string;
	role: UserRole;
};

type ApiSuccess<T> = {
	data: T;
};

async function postAuthRequest<T>(
	action: "nextAuthCredentials" | "nextAuthGoogle" | "nextAuthGetUser",
	body: Record<string, unknown>,
	headers?: Record<string, string>,
): Promise<T | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);

	try {
		const response = await fetch(
			`${getServerApiBaseUrl()}/api/v1/auth/${action}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...headers },
				body: JSON.stringify(body),
				signal: controller.signal,
			},
		);

		if (!response.ok) return null;

		const payload = (await response.json()) as ApiSuccess<T>;
		return payload.data;
	} catch (error) {
		void logger.logError("API auth request failed", error, {
			action,
			feature: "auth",
			operation: action,
		});
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

export function authorizeCredentials(input: {
	email: string;
	password: string;
}): Promise<WebAuthUser | null> {
	return postAuthRequest<WebAuthUser>("nextAuthCredentials", input);
}

export function resolveGoogleUser(input: {
	idToken: string;
}): Promise<WebAuthUser | null> {
	return postAuthRequest<WebAuthUser>("nextAuthGoogle", input);
}

export function getAuthUser(input: {
	userId: string;
}): Promise<WebAuthUserMinimal | null> {
	const secret = process.env.INTERNAL_API_SECRET;
	if (!secret) return Promise.resolve(null);
	return postAuthRequest<WebAuthUserMinimal>("nextAuthGetUser", input, {
		"x-internal-secret": secret,
	});
}
