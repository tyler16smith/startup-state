import { logger } from "~/lib/logger";
import { getServerApiBaseUrl } from "~/server/api-url";

type WebAuthUser = {
	id: string;
	email: string | null;
	name: string | null;
	image: string | null;
	twoFactorEnabled: boolean;
};

type ApiSuccess<T> = {
	data: T;
};

async function postAuthRequest<T>(
	action: "nextAuthCredentials" | "nextAuthGoogle",
	body: Record<string, unknown>,
): Promise<T | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);

	try {
		const response = await fetch(
			`${getServerApiBaseUrl()}/api/v1/auth/${action}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
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
