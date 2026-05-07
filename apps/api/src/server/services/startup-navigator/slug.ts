export function slugify(value: string): string {
	const slug = value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 180);

	return slug || "listing";
}

export async function createUniqueSlug(
	baseValue: string,
	exists: (slug: string) => Promise<boolean>,
	currentSlug?: string,
): Promise<string> {
	const baseSlug = slugify(currentSlug || baseValue);
	let candidate = baseSlug;
	let suffix = 2;

	while (await exists(candidate)) {
		candidate = `${baseSlug}-${suffix}`;
		suffix += 1;
	}

	return candidate;
}
