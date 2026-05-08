import Papa from "papaparse";
import type { z } from "zod";
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
	asArray,
	csvImportSchema,
	founderProfileInputSchema,
	resourceInputSchema,
	resourceQuerySchema,
} from "./schemas";
import { createUniqueSlug } from "./slug";

type Db = PrismaClient;
type ResourceWithSaved = Prisma.ResourceGetPayload<{
	include: { savedBy: true };
}>;

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
			{ category: containsInsensitive(query.q) },
			{ subcategory: containsInsensitive(query.q) },
		];
	}

	if (query.stage) where.stages = { has: query.stage };
	if (query.sector) where.sectors = { has: query.sector };
	if (query.goal) where.goals = { has: query.goal };
	if (query.region) where.regions = { has: query.region };
	if (query.businessType) where.businessTypes = { has: query.businessType };

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
		query,
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
	profile: z.infer<typeof founderProfileInputSchema>,
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
		},
	};
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

	return {
		recommendations: recommendations.slice(0, 12),
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

function hasCsvRowValue(row: Record<string, unknown>) {
	return Object.values(row).some((value) => {
		if (typeof value === "string") return Boolean(value.trim());
		return value !== null && value !== undefined;
	});
}

export async function importResourcesFromCsv(db: Db, input: unknown) {
	const { csv } = csvImportSchema.parse(input);
	const parsed = Papa.parse<Record<string, unknown>>(csv, {
		header: true,
		skipEmptyLines: "greedy",
	});

	let imported = 0;
	const errors: string[] = [];

	for (const [index, row] of parsed.data.entries()) {
		if (!hasCsvRowValue(row)) continue;

		try {
			await createResource(db, {
				name: pickCsvValue(row, ["name", "Name"]),
				description: pickCsvValue(row, ["description", "Description"]),
				shortDescription: pickCsvValue(row, [
					"short description",
					"shortDescription",
				]),
				websiteUrl: pickCsvValue(row, ["website", "websiteUrl", "url"]),
				category: pickCsvValue(row, ["category"]),
				subcategory: pickCsvValue(row, ["subcategory"]),
				stages: asArray(pickCsvValue(row, ["stage", "stages"])),
				sectors: asArray(pickCsvValue(row, ["sector", "sectors"])),
				goals: asArray(pickCsvValue(row, ["goal", "goals"])),
				regions: asArray(pickCsvValue(row, ["region", "regions"])),
				businessTypes: asArray(
					pickCsvValue(row, ["business type", "businessTypes"]),
				),
				eligibilityTags: asArray(
					pickCsvValue(row, ["eligibility", "eligibilityTags"]),
				),
				contactEmail: pickCsvValue(row, ["contact email", "contactEmail"]),
				contactPhone: pickCsvValue(row, ["contact phone", "contactPhone"]),
				city: pickCsvValue(row, ["city"]),
				county: pickCsvValue(row, ["county"]),
			});
			imported += 1;
		} catch (error) {
			errors.push(
				`Row ${index + 2}: ${error instanceof Error ? error.message : "Invalid row"}`,
			);
		}
	}

	if (errors.length) {
		logger.warn("Resource CSV import completed with errors", {
			feature: "startup-navigator",
			operation: "importResources",
			imported,
			errors: errors.length,
		});
	}

	return { imported, errors };
}
