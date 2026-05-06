import { setAuthState } from "./chrome-storage";
import type { AuthState } from "./types";

export function readAuthStateFromUrl(url: string): AuthState {
	const parsedUrl = new URL(url);
	const accessToken = parsedUrl.searchParams.get("appAccessToken");
	const appUserId = parsedUrl.searchParams.get("appUserId");
	const expiresAt = parsedUrl.searchParams.get("expiresAt");

	if (!accessToken || !appUserId || !expiresAt) return null;

	return {
		appUserId,
		email: parsedUrl.searchParams.get("email"),
		accessToken,
		refreshToken: parsedUrl.searchParams.get("refreshToken"),
		expiresAt,
	};
}

export async function persistAuthFromCurrentUrl(): Promise<boolean> {
	const auth = readAuthStateFromUrl(window.location.href);
	if (!auth) return false;

	await setAuthState(auth);
	window.history.replaceState({}, document.title, window.location.pathname);
	return true;
}
