import type {
	FounderProfileInput,
	Resource,
	ResourceRecommendation,
} from "~/lib/startup-api";

export const FOUNDER_INTAKE_KEY = "startup-founder-intake";
export const FOUNDER_RESULT_KEY = "startup-founder-result";

type ResourceArrayField =
	| "stages"
	| "communities"
	| "sectors"
	| "goals"
	| "regions"
	| "businessTypes"
	| "eligibilityTags";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function stringArray(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item) => {
		if (typeof item !== "string") return [];
		const trimmed = item.trim();
		return trimmed ? [trimmed] : [];
	});
}

export function readStorageJson(key: string) {
	const raw = sessionStorage.getItem(key);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		sessionStorage.removeItem(key);
		return null;
	}
}

export function normalizeFounderProfile(
	value: unknown,
): FounderProfileInput | null {
	if (!isRecord(value)) return null;
	return {
		stage: typeof value.stage === "string" ? value.stage : undefined,
		city: typeof value.city === "string" ? value.city : undefined,
		county: typeof value.county === "string" ? value.county : undefined,
		region: typeof value.region === "string" ? value.region : undefined,
		sectors: stringArray(value.sectors),
		goals: stringArray(value.goals),
		businessTypes: stringArray(value.businessTypes),
		fundingNeeds: stringArray(value.fundingNeeds),
		hiringStatus:
			typeof value.hiringStatus === "string" ? value.hiringStatus : undefined,
		keywords: typeof value.keywords === "string" ? value.keywords : undefined,
	};
}

function normalizeResource(resource: Resource) {
	const resourceRecord = resource as Resource &
		Record<ResourceArrayField, unknown>;
	return {
		...resource,
		stages: stringArray(resourceRecord.stages),
		communities: stringArray(resourceRecord.communities),
		sectors: stringArray(resourceRecord.sectors),
		goals: stringArray(resourceRecord.goals),
		regions: stringArray(resourceRecord.regions),
		businessTypes: stringArray(resourceRecord.businessTypes),
		eligibilityTags: stringArray(resourceRecord.eligibilityTags),
	};
}

function normalizeRecommendation(
	value: unknown,
): ResourceRecommendation | null {
	if (!isRecord(value) || !isRecord(value.resource)) return null;
	if (
		typeof value.resource.id !== "string" ||
		typeof value.resource.name !== "string"
	) {
		return null;
	}
	return {
		resource: normalizeResource(value.resource as Resource),
		score: typeof value.score === "number" ? value.score : 0,
		reasons: stringArray(value.reasons),
		matchedFields: isRecord(value.matchedFields) ? value.matchedFields : {},
	};
}

export function normalizeRecommendations(value: unknown) {
	return Array.isArray(value)
		? value.flatMap((item) => {
				const recommendation = normalizeRecommendation(item);
				return recommendation ? [recommendation] : [];
			})
		: [];
}

function sameStringArray(left: string[], right: string[]) {
	return (
		left.length === right.length &&
		left.every((item, index) => item === right[index])
	);
}

function isSameFounderProfile(
	left: FounderProfileInput,
	right: FounderProfileInput,
) {
	return (
		left.stage === right.stage &&
		left.city === right.city &&
		left.county === right.county &&
		left.region === right.region &&
		left.hiringStatus === right.hiringStatus &&
		left.keywords === right.keywords &&
		sameStringArray(left.sectors, right.sectors) &&
		sameStringArray(left.goals, right.goals) &&
		sameStringArray(left.businessTypes, right.businessTypes) &&
		sameStringArray(left.fundingNeeds, right.fundingNeeds)
	);
}

export function cachedRecommendationsForProfile(profile: FounderProfileInput) {
	const cached = readStorageJson(FOUNDER_RESULT_KEY);
	if (!isRecord(cached)) return null;
	const cachedProfile = normalizeFounderProfile(cached.profile);
	if (!cachedProfile || !isSameFounderProfile(cachedProfile, profile)) {
		return null;
	}
	if (!Array.isArray(cached.recommendations)) return null;
	return normalizeRecommendations(cached.recommendations);
}
