export function getWebsiteDomain(value?: string | null) {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	try {
		return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
			.hostname.replace(/^www\./, "")
			.toLowerCase();
	} catch {
		return null;
	}
}
