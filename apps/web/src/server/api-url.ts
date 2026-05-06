export function getServerApiBaseUrl(): string {
	const configured =
		process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

	if (configured) return configured.replace(/\/$/, "");

	throw new Error("API_URL or NEXT_PUBLIC_API_URL must be set");
}
