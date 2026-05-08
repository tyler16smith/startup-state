import crypto from "node:crypto";
import OpenAI from "openai";
import Papa from "papaparse";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { logger } from "~/lib/logger";
import { createApiError } from "~/server/api-context";
import type { Prisma, PrismaClient } from "../../../../generated/prisma";
import {
	findRelevantResourceMatches,
	isResourceEmbeddingConfigured,
	type ResourceSemanticMatch,
	upsertResourceEmbedding,
} from "./resource-rag";
import {
	csvImportCommitSchema,
	csvImportSchema,
	founderProfileInputSchema,
	resourceInputSchema,
	resourceQuerySchema,
} from "./schemas";
import { createUniqueSlug } from "./slug";
import { getWebsiteDomain } from "./website-domain";

type Db = PrismaClient;
type ResourceWithSaved = Prisma.ResourceGetPayload<{
	include: { savedBy: true };
}>;
type FounderProfileInput = z.infer<typeof founderProfileInputSchema>;

const CSV_IMPORT_SOURCE = "csv_upload";
const IMPORT_SESSION_TTL_MS = 30 * 60 * 1000;

const founderRankedResourceSchema = z.object({
	recommendations: z
		.array(
			z.object({
				resourceId: z.string().min(1),
				why: z.string().min(10).max(500),
				score: z.number().min(0).max(100).optional(),
			}),
		)
		.min(1)
		.max(12),
});

const founderRankedResourceJsonSchema = zodToJsonSchema(
	founderRankedResourceSchema,
	"FounderResourceRecommendations",
);

let openaiClient: OpenAI | undefined;

function getOpenAIClient() {
	if (openaiClient) return openaiClient;
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return undefined;
	openaiClient = new OpenAI({ apiKey });
	return openaiClient;
}

function savedCount(item: unknown) {
	const savedBy = (item as { savedBy?: unknown[] }).savedBy;
	return Array.isArray(savedBy) ? savedBy.length : 0;
}

function cleanOptional(value: string | null | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

function containsInsensitive(value: string): Prisma.StringFilter {
	return { contains: value, mode: "insensitive" };
}

function uniqueValues(values: string[]) {
	const seen = new Set<string>();
	return values.filter((value) => {
		const key = value.toLowerCase().trim();
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function filterValues(...values: (string[] | undefined)[]) {
	return uniqueValues(values.flatMap((items) => items ?? []));
}

function listText(values: string[]) {
	return values.length ? values.join(", ") : "any";
}

function clampScore(score: number) {
	return Math.max(0, Math.min(100, Math.round(score)));
}

function firstFilterValue(values: string[] | undefined) {
	return values?.at(0);
}

function buildResourceWhere(
	input: unknown,
	options: { admin?: boolean } = {},
): Prisma.ResourceWhereInput {
	const query = resourceQuerySchema.parse(input);
	const where: Prisma.ResourceWhereInput = {};

	if (query.status) {
		where.status = query.status;
	} else if (!options.admin) {
		where.status = "PUBLISHED";
	}

	if (query.q) {
		where.OR = [
			{ name: containsInsensitive(query.q) },
			{ description: containsInsensitive(query.q) },
			{ shortDescription: containsInsensitive(query.q) },
			{ websiteUrl: containsInsensitive(query.q) },
			{ contactEmail: containsInsensitive(query.q) },
			{ category: containsInsensitive(query.q) },
			{ subcategory: containsInsensitive(query.q) },
			{ communities: { has: query.q } },
			{ sectors: { has: query.q } },
			{ goals: { has: query.q } },
			{ regions: { has: query.q } },
		];
	}

	const stages = filterValues(query.stage);
	const communities = filterValues(query.community);
	const sectors = filterValues(query.sector, query.industry);
	const goals = filterValues(query.goal, query.topic);
	const regions = filterValues(query.region, query.location);
	const businessTypes = filterValues(query.businessType);

	if (stages.length) where.stages = { hasSome: stages };
	if (communities.length) where.communities = { hasSome: communities };
	if (sectors.length) where.sectors = { hasSome: sectors };
	if (goals.length) where.goals = { hasSome: goals };
	if (regions.length) where.regions = { hasSome: regions };
	if (businessTypes.length) where.businessTypes = { hasSome: businessTypes };

	return where;
}

function resourceOrderBy(
	input: unknown,
): Prisma.ResourceOrderByWithRelationInput {
	const query = resourceQuerySchema.parse(input);
	if (query.sort === "name") return { name: "asc" };
	return { updatedAt: "desc" };
}

export async function searchResources(
	db: Db,
	input: unknown,
	options: { admin?: boolean; userId?: string | null } = {},
) {
	const query = resourceQuerySchema.parse(input);
	const where = buildResourceWhere(query, options);
	const [items, total] = await Promise.all([
		db.resource.findMany({
			where,
			orderBy: resourceOrderBy(query),
			take: query.limit,
			skip: query.offset,
			include: options.userId
				? { savedBy: { where: { userId: options.userId } } }
				: undefined,
		}),
		db.resource.count({ where }),
	]);

	return {
		items: items.map((item) => ({
			...item,
			isSaved: savedCount(item) > 0,
			savedBy: undefined,
		})),
		total,
		limit: query.limit,
		offset: query.offset,
	};
}

export async function getResourceById(
	db: Db,
	input: { id?: string; slug?: string },
	options: { admin?: boolean; userId?: string | null } = {},
) {
	if (!input.id && !input.slug)
		throw createApiError("Resource id required", 400);
	const resource = await db.resource.findFirst({
		where: {
			...(input.id ? { id: input.id } : { slug: input.slug }),
			...(options.admin ? {} : { status: "PUBLISHED" as const }),
		},
		include: options.userId
			? { savedBy: { where: { userId: options.userId } } }
			: undefined,
	});

	if (!resource) throw createApiError("Resource not found", 404);

	const related = await db.resource.findMany({
		where: {
			id: { not: resource.id },
			status: "PUBLISHED",
			OR: [
				...(resource.category ? [{ category: resource.category }] : []),
				...(resource.goals.length
					? [{ goals: { hasSome: resource.goals } }]
					: []),
				...(resource.sectors.length
					? [{ sectors: { hasSome: resource.sectors } }]
					: []),
			],
		},
		take: 3,
		orderBy: { updatedAt: "desc" },
	});

	return {
		...resource,
		isSaved: savedCount(resource) > 0,
		savedBy: undefined,
		related,
	};
}

function embeddingContent(input: {
	name: string;
	description: string;
	shortDescription?: string | null;
	category?: string | null;
	subcategory?: string | null;
	stages?: string[];
	communities?: string[];
	sectors?: string[];
	goals?: string[];
	regions?: string[];
	businessTypes?: string[];
	eligibilityTags?: string[];
	city?: string | null;
	county?: string | null;
}) {
	return [
		`Name: ${input.name}`,
		input.shortDescription
			? `Short description: ${input.shortDescription}`
			: null,
		`Description: ${input.description}`,
		input.category ? `Category: ${input.category}` : null,
		input.subcategory ? `Subcategory: ${input.subcategory}` : null,
		input.city || input.county
			? `Location: ${[input.city, input.county].filter(Boolean).join(", ")}`
			: null,
		input.stages?.length ? `Founder stages: ${input.stages.join(", ")}` : null,
		input.communities?.length
			? `Communities served: ${input.communities.join(", ")}`
			: null,
		input.sectors?.length ? `Sectors: ${input.sectors.join(", ")}` : null,
		input.goals?.length ? `Goals: ${input.goals.join(", ")}` : null,
		input.regions?.length
			? `Regions served: ${input.regions.join(", ")}`
			: null,
		input.businessTypes?.length
			? `Business types: ${input.businessTypes.join(", ")}`
			: null,
		input.eligibilityTags?.length
			? `Eligibility: ${input.eligibilityTags.join(", ")}`
			: null,
	]
		.filter(Boolean)
		.join("\n");
}

async function indexResourceEmbedding(
	db: Db,
	resource: Parameters<typeof embeddingContent>[0] & { id: string },
) {
	try {
		await upsertResourceEmbedding({
			db,
			resourceId: resource.id,
			content: embeddingContent(resource),
		});
	} catch (error) {
		logger.warn("Resource embedding update failed", {
			feature: "startup-navigator",
			operation: "indexResourceEmbedding",
			resourceId: resource.id,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export async function createResource(db: Db, input: unknown) {
	const data = resourceInputSchema.parse(input);
	const slug = await createUniqueSlug(
		data.name,
		async (candidate) =>
			Boolean(await db.resource.findUnique({ where: { slug: candidate } })),
		data.slug,
	);

	const resource = await db.resource.create({
		data: {
			...data,
			slug,
			websiteUrl: cleanOptional(data.websiteUrl),
			contactEmail: cleanOptional(data.contactEmail),
			state: cleanOptional(data.state) ?? "UT",
		},
	});

	await indexResourceEmbedding(db, resource);
	return resource;
}

export async function updateResource(
	db: Db,
	resourceId: string,
	input: unknown,
) {
	const data = resourceInputSchema.partial().parse(input);
	const current = await db.resource.findUnique({ where: { id: resourceId } });
	if (!current) throw createApiError("Resource not found", 404);

	const slug =
		data.name || data.slug
			? await createUniqueSlug(
					data.name ?? current.name,
					async (candidate) => {
						const found = await db.resource.findUnique({
							where: { slug: candidate },
						});
						return Boolean(found && found.id !== resourceId);
					},
					data.slug ?? current.slug,
				)
			: undefined;

	const updated = await db.resource.update({
		where: { id: resourceId },
		data: {
			...data,
			...(slug ? { slug } : {}),
			...(data.websiteUrl !== undefined
				? { websiteUrl: cleanOptional(data.websiteUrl) }
				: {}),
			...(data.contactEmail !== undefined
				? { contactEmail: cleanOptional(data.contactEmail) }
				: {}),
		},
	});

	await indexResourceEmbedding(db, updated);

	return updated;
}

function semanticBonus(match: ResourceSemanticMatch | undefined) {
	if (!match) return 0;
	if (match.rerankScore !== undefined)
		return Math.round(match.rerankScore * 35);
	return Math.max(0, Math.round((1 - match.distance) * 25));
}

async function findResourcesBySemanticMatches(
	db: Db,
	matches: ResourceSemanticMatch[],
	options: { userId?: string | null } = {},
) {
	const ids = matches.map((match) => match.resourceId);
	if (ids.length === 0) return [];
	const order = new Map(ids.map((id, index) => [id, index]));
	const resources = await db.resource.findMany({
		where: { id: { in: ids }, status: "PUBLISHED" },
		include: options.userId
			? { savedBy: { where: { userId: options.userId } } }
			: undefined,
	});

	return resources.sort(
		(left, right) =>
			(order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
			(order.get(right.id) ?? Number.MAX_SAFE_INTEGER),
	);
}

export async function searchRelevantResources(
	db: Db,
	input: unknown,
	options: { userId?: string | null } = {},
) {
	const rawInput =
		typeof input === "object" && input !== null
			? (input as Record<string, unknown>)
			: {};
	const query = resourceQuerySchema.parse({ sort: "relevance", ...rawInput });
	const matches = await findRelevantResourceMatches({
		db,
		query: {
			q: query.q,
			stage: firstFilterValue(query.stage),
			sector: firstFilterValue(filterValues(query.sector, query.industry)),
			goal: firstFilterValue(filterValues(query.goal, query.topic)),
			region: firstFilterValue(filterValues(query.region, query.location)),
			businessType: firstFilterValue(query.businessType),
			status: query.status,
		},
		resultLimit: query.limit,
	});

	if (matches.length === 0) {
		return searchResources(db, query, options);
	}

	const resources = await findResourcesBySemanticMatches(db, matches, options);
	return {
		items: resources.map((item) => ({
			...item,
			isSaved: savedCount(item) > 0,
			savedBy: undefined,
		})),
		total: resources.length,
		limit: query.limit,
		offset: query.offset,
		semantic: true,
	};
}

export async function archiveResource(db: Db, resourceId: string) {
	return db.resource.update({
		where: { id: resourceId },
		data: { status: "ARCHIVED" },
	});
}

export async function saveResource(db: Db, userId: string, resourceId: string) {
	await db.savedResource.upsert({
		where: { userId_resourceId: { userId, resourceId } },
		create: { userId, resourceId },
		update: {},
	});
	return { success: true };
}

export async function unsaveResource(
	db: Db,
	userId: string,
	resourceId: string,
) {
	await db.savedResource.deleteMany({ where: { userId, resourceId } });
	return { success: true };
}

function normalizeSet(values: string[]) {
	return new Set(
		values.map((value) => value.toLowerCase().trim()).filter(Boolean),
	);
}

function intersect(source: string[], target: string[]) {
	const sourceSet = normalizeSet(source);
	return target.filter((value) => sourceSet.has(value.toLowerCase().trim()));
}

function founderSemanticQuery(
	profile: FounderProfileInput,
) {
	return [
		profile.keywords,
		profile.stage ? `Stage: ${profile.stage}` : null,
		profile.region ? `Region: ${profile.region}` : null,
		profile.city ? `City: ${profile.city}` : null,
		profile.county ? `County: ${profile.county}` : null,
		profile.sectors.length ? `Sectors: ${profile.sectors.join(", ")}` : null,
		profile.goals.length ? `Goals: ${profile.goals.join(", ")}` : null,
		profile.fundingNeeds.length
			? `Funding needs: ${profile.fundingNeeds.join(", ")}`
			: null,
		profile.businessTypes.length
			? `Business types: ${profile.businessTypes.join(", ")}`
			: null,
		profile.founderIdentities.length
			? `Founder identities and eligibility: ${profile.founderIdentities.join(", ")}`
			: null,
	]
		.filter(Boolean)
		.join("\n");
}

function scoreResource(resource: ResourceWithSaved, profile: unknown) {
	const input = founderProfileInputSchema.parse(profile);
	const matchedGoals = intersect(resource.goals, [
		...input.goals,
		...input.fundingNeeds,
	]);
	const matchedSectors = intersect(resource.sectors, input.sectors);
	const matchedRegions = intersect(
		resource.regions,
		[input.region, input.city, input.county].filter(Boolean) as string[],
	);
	const matchedBusinessTypes = intersect(
		resource.businessTypes,
		input.businessTypes,
	);
	const matchedFounderIdentities = intersect(
		resource.eligibilityTags,
		input.founderIdentities,
	);
	const stageMatch = Boolean(
		input.stage && normalizeSet(resource.stages).has(input.stage.toLowerCase()),
	);
	const keywordMatch = input.keywords
		? `${resource.name} ${resource.description} ${resource.category ?? ""}`
				.toLowerCase()
				.includes(input.keywords.toLowerCase())
		: false;

	const score =
		(stageMatch ? 30 : 0) +
		(matchedGoals.length > 0
			? 25 + Math.min(matchedGoals.length - 1, 3) * 3
			: 0) +
		(matchedSectors.length > 0 ? 15 : 0) +
		(matchedRegions.length > 0 ? 15 : 0) +
		(matchedBusinessTypes.length > 0 ? 10 : 0) +
		(matchedFounderIdentities.length > 0 ? 12 : 0) +
		(keywordMatch ? 5 : 0);

	const reasons = [
		stageMatch && input.stage
			? `Fits your ${input.stage.replace(/_/g, " ").toLowerCase()} stage.`
			: null,
		matchedGoals.length
			? `Supports ${matchedGoals.slice(0, 3).join(", ")}.`
			: null,
		matchedSectors.length
			? `Relevant to ${matchedSectors.slice(0, 2).join(", ")}.`
			: null,
		matchedRegions.length
			? `Serves ${matchedRegions.slice(0, 2).join(", ")}.`
			: null,
		matchedBusinessTypes.length
			? `Matches ${matchedBusinessTypes.slice(0, 2).join(", ")} businesses.`
			: null,
		matchedFounderIdentities.length
			? `Matches eligibility for ${matchedFounderIdentities.slice(0, 2).join(", ")}.`
			: null,
		keywordMatch ? "Matches your search language." : null,
	].filter(Boolean) as string[];

	return {
		resource: {
			...resource,
			isSaved: resource.savedBy.length > 0,
			savedBy: undefined,
		},
		score,
		reasons: reasons.length
			? reasons
			: ["A broad Utah startup resource worth reviewing."],
		matchedFields: {
			stage: stageMatch,
			goals: matchedGoals,
			sectors: matchedSectors,
			regions: matchedRegions,
			businessTypes: matchedBusinessTypes,
			founderIdentities: matchedFounderIdentities,
		},
	};
}

type ScoredResourceRecommendation = ReturnType<typeof scoreResource>;

function resourcePromptPayload(recommendations: ScoredResourceRecommendation[]) {
	return recommendations.map((recommendation) => ({
		id: recommendation.resource.id,
		name: recommendation.resource.name,
		description:
			recommendation.resource.shortDescription ?? recommendation.resource.description,
		category: recommendation.resource.category,
		subcategory: recommendation.resource.subcategory,
		stages: recommendation.resource.stages,
		communities: recommendation.resource.communities,
		sectors: recommendation.resource.sectors,
		goals: recommendation.resource.goals,
		regions: recommendation.resource.regions,
		businessTypes: recommendation.resource.businessTypes,
		eligibilityTags: recommendation.resource.eligibilityTags,
		city: recommendation.resource.city,
		county: recommendation.resource.county,
		state: recommendation.resource.state,
		algorithmicScore: clampScore(recommendation.score),
		algorithmicReasons: recommendation.reasons,
	}));
}

async function rankFounderResourcesWithLlm(input: {
	profile: FounderProfileInput;
	candidates: ScoredResourceRecommendation[];
}) {
	const client = getOpenAIClient();
	if (!client) {
		throw createApiError(
			"OPENAI_API_KEY is required for founder recommendation personalization",
			501,
		);
	}

	const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
	const systemPrompt = [
		"You rank Utah startup resources for a founder action-plan workflow.",
		"Return only JSON that matches the supplied schema.",
		"Choose up to twelve resources from the candidate list by id.",
		"Each why must be one concise sentence written directly to the founder as a personalized answer.",
		"Ground every why only in the supplied founder profile and resource data.",
		"Treat 'None of these' and 'Prefer not to say' founder identities as neutral signals and do not infer sensitive traits.",
	].join(" ");
	const userPrompt = JSON.stringify({
		founderProfile: {
			stage: input.profile.stage,
			city: input.profile.city,
			county: input.profile.county,
			region: input.profile.region,
			sectors: listText(input.profile.sectors),
			goals: listText(input.profile.goals),
			businessTypes: listText(input.profile.businessTypes),
			fundingNeeds: listText(input.profile.fundingNeeds),
			founderIdentities: listText(input.profile.founderIdentities),
			hiringStatus: input.profile.hiringStatus,
			keywords: input.profile.keywords,
		},
		jsonSchema: founderRankedResourceJsonSchema,
		candidateResources: resourcePromptPayload(input.candidates),
	});

	let lastError: string | undefined;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			const response = await client.chat.completions.create({
				model,
				messages: [
					{ role: "system", content: systemPrompt },
					{
						role: "user",
						content:
							attempt === 1
								? userPrompt
								: `${userPrompt}\n\nPrevious JSON failed validation: ${lastError}. Return repaired JSON only.`,
					},
				],
				response_format: { type: "json_object" },
				temperature: 0.2,
			});
			const content = response.choices.at(0)?.message.content;
			if (!content) throw new Error("LLM returned no content");
			const parsedJson = JSON.parse(content) as unknown;
			const parsed = founderRankedResourceSchema.safeParse(parsedJson);
			if (parsed.success) return parsed.data;
			lastError = parsed.error.message;
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
			logger.warn("Founder recommendation ranking attempt failed", {
				feature: "startup-navigator",
				operation: "founderRecommend",
				attempt,
				error: lastError,
			});
		}
	}

	throw createApiError("Founder recommendations could not be personalized", 502);
}

export async function recommendResourcesForFounderProfile(
	db: Db,
	input: unknown,
	options: { userId?: string | null; persistProfile?: boolean } = {},
) {
	const profile = founderProfileInputSchema.parse(input);
	if (options.userId && options.persistProfile) {
		const { keywords: _keywords, ...profileData } = profile;
		await db.founderProfile.create({
			data: { ...profileData, userId: options.userId },
		});
	}

	const semanticMatches = await findRelevantResourceMatches({
		db,
		query: {
			q: founderSemanticQuery(profile),
		},
		resultLimit: 20,
	});
	const semanticByResourceId = new Map(
		semanticMatches.map((match) => [match.resourceId, match]),
	);

	const resources = await db.resource.findMany({
		where: { status: "PUBLISHED" },
		include: options.userId
			? { savedBy: { where: { userId: options.userId } } }
			: { savedBy: true },
		orderBy: { updatedAt: "desc" },
		take: 100,
	});

	const recommendations = resources
		.map((resource) => {
			const recommendation = scoreResource(resource, profile);
			const bonus = semanticBonus(semanticByResourceId.get(resource.id));
			return {
				...recommendation,
				score: recommendation.score + bonus,
				reasons:
					bonus > 0
						? ["Matches your search intent.", ...recommendation.reasons]
						: recommendation.reasons,
			};
		})
		.sort(
			(left, right) =>
				right.score - left.score ||
				left.resource.name.localeCompare(right.resource.name),
		);
		const candidatePool = recommendations.slice(0, 20);

		if (candidatePool.length === 0) {
			return { recommendations: [], profile };
		}

		const ranked = await rankFounderResourcesWithLlm({
			profile,
			candidates: candidatePool,
		});
		const recommendationsById = new Map(
			candidatePool.map((recommendation) => [
				recommendation.resource.id,
				recommendation,
			]),
		);
		const personalizedRecommendations = ranked.recommendations.flatMap(
			(recommendation) => {
				const baseRecommendation = recommendationsById.get(
					recommendation.resourceId,
				);
				if (!baseRecommendation) return [];
				return [
					{
						...baseRecommendation,
						score: clampScore(recommendation.score ?? baseRecommendation.score),
						reasons: [recommendation.why],
					},
				];
			},
		);

		if (personalizedRecommendations.length === 0) {
			throw createApiError("Founder recommendations could not be personalized", 502);
		}

	return {
			recommendations: personalizedRecommendations,
		profile,
	};
}

export async function reindexResourceEmbeddings(
	db: Db,
	input: { id?: string } = {},
) {
	if (!isResourceEmbeddingConfigured()) {
		throw createApiError(
			"OPENAI_API_KEY is required for resource reindexing",
			501,
		);
	}

	const resources = await db.resource.findMany({
		where: input.id ? { id: input.id } : { status: { not: "ARCHIVED" } },
		orderBy: { updatedAt: "desc" },
	});

	let indexed = 0;
	for (const resource of resources) {
		const result = await upsertResourceEmbedding({
			db,
			resourceId: resource.id,
			content: embeddingContent(resource),
			requireProvider: true,
		});
		if (result.embedded) indexed += 1;
	}

	return { indexed, total: resources.length };
}

function normalizeCsvRow(
	row: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]),
	);
}

function pickCsvValue(row: Record<string, unknown>, names: string[]) {
	const normalized = normalizeCsvRow(row);
	for (const name of names) {
		const value = normalized[name.trim().toLowerCase()];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return undefined;
}

function pickCsvList(row: Record<string, unknown>, names: string[]) {
	const value = pickCsvValue(row, names);
	if (!value) return [];
	return uniqueValues(
		value
			.split(/[|,]/)
			.map((item) => item.trim())
			.filter(Boolean),
	);
}

function hasCsvRowValue(row: Record<string, unknown>) {
	return Object.values(row).some((value) => {
		if (typeof value === "string") return Boolean(value.trim());
		return value !== null && value !== undefined;
	});
}

function normalizeImportKey(value: string | null | undefined) {
	return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function normalizeImportDomain(value: string | null | undefined) {
	return getWebsiteDomain(value) ?? "";
}

function isValidUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

function isValidEmail(value: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type PreparedCsvResource = {
	rowNumber: number;
	sourceId?: string;
	name: string;
	description: string;
	websiteUrl?: string;
	contactEmail?: string;
	stages: string[];
	communities: string[];
	sectors: string[];
	goals: string[];
	regions: string[];
	businessTypes: string[];
	eligibilityTags: string[];
};

type ImportPreviewRow = {
	rowNumber: number;
	action: "create" | "update" | "duplicate" | "invalid";
	name?: string;
	existingResourceName?: string;
	errors: string[];
};

type MatchedCsvResource = PreparedCsvResource & {
	action: "create" | "update";
	existingResourceId?: string;
	existingResourceName?: string;
};

type ResourceImportPreview = {
	importSessionId: string;
	totalRows: number;
	validRows: number;
	invalidRows: number;
	newResources: number;
	updatedResources: number;
	duplicateRows: number;
	newTaxonomyValues: {
		communities: string[];
		industries: string[];
		locations: string[];
		topics: string[];
	};
	errors: string[];
	rows: ImportPreviewRow[];
};

type ResourceImportSession = {
	createdAt: number;
	preparedRows: PreparedCsvResource[];
	preview: ResourceImportPreview;
};

const resourceImportSessions = new Map<string, ResourceImportSession>();

function pruneImportSessions() {
	const now = Date.now();
	for (const [id, session] of resourceImportSessions) {
		if (now - session.createdAt > IMPORT_SESSION_TTL_MS) {
			resourceImportSessions.delete(id);
		}
	}
}

function duplicateKey(row: PreparedCsvResource) {
	const websiteDomain = normalizeImportDomain(row.websiteUrl);
	if (websiteDomain) return `domain:${websiteDomain}`;
	if (row.sourceId) return `source:${normalizeImportKey(row.sourceId)}`;
	return `title:${normalizeImportKey(row.name)}`;
}

function prepareCsvRows(csv: string) {
	const parsed = Papa.parse<Record<string, unknown>>(csv, {
		header: true,
		skipEmptyLines: "greedy",
	});
	const preparedRows: PreparedCsvResource[] = [];
	const previewRows: ImportPreviewRow[] = [];
	const errors: string[] = [];
	const seenKeys = new Set<string>();
	let totalRows = 0;
	let duplicateRows = 0;

	for (const [index, row] of parsed.data.entries()) {
		if (!hasCsvRowValue(row)) continue;
		totalRows += 1;
		const rowNumber = index + 2;
		const rowErrors: string[] = [];
		const name = pickCsvValue(row, ["title", "name"]);
		const description = pickCsvValue(row, ["description"]);
		const websiteUrl = pickCsvValue(row, [
			"link",
			"website",
			"websiteUrl",
			"url",
		]);
		const contactEmail = pickCsvValue(row, [
			"email",
			"contact email",
			"contactEmail",
		]);
		const sectors = pickCsvList(row, [
			"industries",
			"industry",
			"sectors",
			"sector",
		]);
		const goals = pickCsvList(row, ["topics", "topic", "goals", "goal"]);
		const regions = pickCsvList(row, [
			"locations",
			"location",
			"regions",
			"region",
		]);

		if (!name) rowErrors.push("Title is required");
		if (!description) rowErrors.push("description is required");
		if (description && description.length < 10)
			rowErrors.push("description must be at least 10 characters");
		if (!sectors.length) rowErrors.push("Industries is required");
		if (!regions.length) rowErrors.push("Locations is required");
		if (!goals.length) rowErrors.push("Topics is required");
		if (websiteUrl && !isValidUrl(websiteUrl))
			rowErrors.push("link must be a valid http(s) URL");
		if (contactEmail && !isValidEmail(contactEmail))
			rowErrors.push("email must be valid");

		if (rowErrors.length || !name || !description) {
			const rowMessages = rowErrors.map(
				(error) => `Row ${rowNumber}: ${error}`,
			);
			errors.push(...rowMessages);
			previewRows.push({
				rowNumber,
				action: "invalid",
				name,
				errors: rowErrors,
			});
			continue;
		}

		const prepared: PreparedCsvResource = {
			rowNumber,
			sourceId: pickCsvValue(row, ["id", "sourceId", "source id"]),
			name,
			description,
			websiteUrl,
			contactEmail,
			stages: pickCsvList(row, ["stages", "stage"]),
			communities: pickCsvList(row, ["communities", "community"]),
			sectors,
			goals,
			regions,
			businessTypes: pickCsvList(row, [
				"business types",
				"business type",
				"businessTypes",
			]),
			eligibilityTags: pickCsvList(row, [
				"eligibility",
				"eligibilityTags",
				"eligibility tags",
			]),
		};
		const key = duplicateKey(prepared);
		if (seenKeys.has(key)) {
			duplicateRows += 1;
			previewRows.push({
				rowNumber,
				action: "duplicate",
				name,
				errors: ["Duplicate row in this CSV"],
			});
			continue;
		}
		seenKeys.add(key);
		preparedRows.push(prepared);
	}

	for (const parseError of parsed.errors) {
		errors.push(`CSV parse error: ${parseError.message}`);
	}

	return { preparedRows, previewRows, errors, totalRows, duplicateRows };
}

async function matchCsvResources(db: Db, rows: PreparedCsvResource[]) {
	const sourceIds = uniqueValues(
		rows.flatMap((row) => (row.sourceId ? [row.sourceId] : [])),
	);
	const websiteUrls = uniqueValues(
		rows.flatMap((row) => (row.websiteUrl ? [row.websiteUrl] : [])),
	);
	const websiteDomains = uniqueValues(
		websiteUrls.flatMap((websiteUrl) => {
			const domain = normalizeImportDomain(websiteUrl);
			return domain ? [domain] : [];
		}),
	);
	const names = uniqueValues(rows.map((row) => row.name));
	const or: Prisma.ResourceWhereInput[] = [];
	if (sourceIds.length) or.push({ sourceId: { in: sourceIds } });
	for (const domain of websiteDomains) {
		or.push({ websiteUrl: { contains: domain, mode: "insensitive" } });
	}
	if (names.length) or.push({ name: { in: names, mode: "insensitive" } });

	const existing = or.length
		? await db.resource.findMany({
				where: { OR: or },
				select: { id: true, name: true, sourceId: true, websiteUrl: true },
			})
		: [];

	const bySourceId = new Map(
		existing.flatMap((resource) =>
			resource.sourceId
				? [[normalizeImportKey(resource.sourceId), resource] as const]
				: [],
		),
	);
	const byWebsiteDomain = new Map(
		existing.flatMap((resource) =>
			normalizeImportDomain(resource.websiteUrl)
				? [[normalizeImportDomain(resource.websiteUrl), resource] as const]
				: [],
		),
	);
	const byName = new Map(
		existing.map(
			(resource) => [normalizeImportKey(resource.name), resource] as const,
		),
	);

	return rows.map<MatchedCsvResource>((row) => {
		const websiteDomain = normalizeImportDomain(row.websiteUrl);
		const existingResource =
			(websiteDomain ? byWebsiteDomain.get(websiteDomain) : undefined) ??
			(row.sourceId
				? bySourceId.get(normalizeImportKey(row.sourceId))
				: undefined) ??
			byName.get(normalizeImportKey(row.name));

		return {
			...row,
			action: existingResource ? "update" : "create",
			existingResourceId: existingResource?.id,
			existingResourceName: existingResource?.name,
		};
	});
}

async function taxonomySets(db: Db) {
	const resources = await db.resource.findMany({
		select: { communities: true, sectors: true, goals: true, regions: true },
	});
	return {
		communities: normalizeSet(
			resources.flatMap((resource) => resource.communities),
		),
		industries: normalizeSet(resources.flatMap((resource) => resource.sectors)),
		locations: normalizeSet(resources.flatMap((resource) => resource.regions)),
		topics: normalizeSet(resources.flatMap((resource) => resource.goals)),
	};
}

function newValues(values: string[], existing: Set<string>) {
	return uniqueValues(values).filter(
		(value) => !existing.has(value.toLowerCase().trim()),
	);
}

export async function listResourceTaxonomy(db: Db) {
	const resources = await db.resource.findMany({
		where: { status: "PUBLISHED" },
		select: { communities: true, sectors: true, goals: true, regions: true },
	});
	const sortValues = (values: string[]) =>
		uniqueValues(values).sort((left, right) => left.localeCompare(right));
	return {
		communities: sortValues(
			resources.flatMap((resource) => resource.communities),
		),
		industries: sortValues(resources.flatMap((resource) => resource.sectors)),
		locations: sortValues(resources.flatMap((resource) => resource.regions)),
		topics: sortValues(resources.flatMap((resource) => resource.goals)),
	};
}

export async function previewResourceCsvImport(db: Db, input: unknown) {
	pruneImportSessions();
	const { csv } = csvImportSchema.parse(input);
	const prepared = prepareCsvRows(csv);
	const matchedRows = await matchCsvResources(db, prepared.preparedRows);
	const existingTaxonomy = await taxonomySets(db);
	const importSessionId = crypto.randomUUID();
	const rows: ImportPreviewRow[] = [
		...prepared.previewRows,
		...matchedRows.map((row) => ({
			rowNumber: row.rowNumber,
			action: row.action,
			name: row.name,
			existingResourceName: row.existingResourceName,
			errors: [],
		})),
	].sort((left, right) => left.rowNumber - right.rowNumber);
	const preview: ResourceImportPreview = {
		importSessionId,
		totalRows: prepared.totalRows,
		validRows: matchedRows.length,
		invalidRows: rows.filter((row) => row.action === "invalid").length,
		newResources: matchedRows.filter((row) => row.action === "create").length,
		updatedResources: matchedRows.filter((row) => row.action === "update")
			.length,
		duplicateRows: prepared.duplicateRows,
		newTaxonomyValues: {
			communities: newValues(
				matchedRows.flatMap((row) => row.communities),
				existingTaxonomy.communities,
			),
			industries: newValues(
				matchedRows.flatMap((row) => row.sectors),
				existingTaxonomy.industries,
			),
			locations: newValues(
				matchedRows.flatMap((row) => row.regions),
				existingTaxonomy.locations,
			),
			topics: newValues(
				matchedRows.flatMap((row) => row.goals),
				existingTaxonomy.topics,
			),
		},
		errors: prepared.errors,
		rows,
	};

	resourceImportSessions.set(importSessionId, {
		createdAt: Date.now(),
		preparedRows: prepared.preparedRows,
		preview,
	});
	return preview;
}

async function createImportedResource(
	db: Db,
	row: PreparedCsvResource,
	status: "DRAFT" | "PUBLISHED",
) {
	const slug = await createUniqueSlug(row.name, async (candidate) =>
		Boolean(await db.resource.findUnique({ where: { slug: candidate } })),
	);
	const resource = await db.resource.create({
		data: {
			name: row.name,
			slug,
			description: row.description,
			websiteUrl: cleanOptional(row.websiteUrl),
			contactEmail: cleanOptional(row.contactEmail),
			status,
			stages: row.stages,
			communities: row.communities,
			sectors: row.sectors,
			goals: row.goals,
			regions: row.regions,
			businessTypes: row.businessTypes,
			eligibilityTags: row.eligibilityTags,
			state: "UT",
			source: CSV_IMPORT_SOURCE,
			sourceId: cleanOptional(row.sourceId),
			lastSyncedAt: new Date(),
		},
	});
	await indexResourceEmbedding(db, resource);
	return resource;
}

async function updateImportedResource(
	db: Db,
	resourceId: string,
	row: PreparedCsvResource,
	publishImmediately: boolean,
) {
	const current = await db.resource.findUnique({ where: { id: resourceId } });
	if (!current) throw createApiError("Resource not found", 404);
	const slug = await createUniqueSlug(
		row.name,
		async (candidate) => {
			const found = await db.resource.findUnique({
				where: { slug: candidate },
			});
			return Boolean(found && found.id !== resourceId);
		},
		current.slug,
	);
	const resource = await db.resource.update({
		where: { id: resourceId },
		data: {
			name: row.name,
			slug,
			description: row.description,
			websiteUrl: cleanOptional(row.websiteUrl),
			contactEmail: cleanOptional(row.contactEmail),
			...(publishImmediately ? { status: "PUBLISHED" as const } : {}),
			stages: row.stages.length ? row.stages : current.stages,
			communities: row.communities,
			sectors: row.sectors,
			goals: row.goals,
			regions: row.regions,
			businessTypes: row.businessTypes.length
				? row.businessTypes
				: current.businessTypes,
			eligibilityTags: row.eligibilityTags.length
				? row.eligibilityTags
				: current.eligibilityTags,
			source: current.source ?? CSV_IMPORT_SOURCE,
			sourceId: cleanOptional(row.sourceId) ?? current.sourceId,
			lastSyncedAt: new Date(),
		},
	});
	await indexResourceEmbedding(db, resource);
	return resource;
}

export async function commitResourceCsvImport(db: Db, input: unknown) {
	pruneImportSessions();
	const { importSessionId, publishImmediately } =
		csvImportCommitSchema.parse(input);
	const session = resourceImportSessions.get(importSessionId);
	if (!session) throw createApiError("Import session expired", 404);
	const matchedRows = await matchCsvResources(db, session.preparedRows);
	let imported = 0;
	let created = 0;
	let updated = 0;
	const errors: string[] = [];

	for (const row of matchedRows) {
		try {
			if (row.existingResourceId) {
				await updateImportedResource(
					db,
					row.existingResourceId,
					row,
					publishImmediately,
				);
				updated += 1;
			} else {
				await createImportedResource(
					db,
					row,
					publishImmediately ? "PUBLISHED" : "DRAFT",
				);
				created += 1;
			}
			imported += 1;
		} catch (error) {
			errors.push(
				`Row ${row.rowNumber}: ${
					error instanceof Error ? error.message : "Import failed"
				}`,
			);
		}
	}

	resourceImportSessions.delete(importSessionId);
	if (errors.length) {
		logger.warn("Resource CSV import commit completed with errors", {
			feature: "startup-navigator",
			operation: "commitResourceCsvImport",
			imported,
			errors: errors.length,
		});
	}
	return {
		imported,
		created,
		updated,
		errors,
		publishedImmediately: publishImmediately,
	};
}

export async function importResourcesFromCsv(db: Db, input: unknown) {
	const preview = await previewResourceCsvImport(db, input);
	return commitResourceCsvImport(db, {
		importSessionId: preview.importSessionId,
		publishImmediately: true,
	});
}
