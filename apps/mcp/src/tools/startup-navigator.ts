import {
	type AgentReference,
	type McpGetByIdOrSlugInput,
	type McpRecommendResourcesInput,
	type McpSearchCompaniesInput,
	type McpSearchResourcesInput,
	mcpToolContracts,
} from "@app/mcp-contracts";
import type { Prisma } from "../../../api/generated/prisma/index.js";
import type { DbClient } from "../lib/db";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

type ResourceRecord = Prisma.ResourceGetPayload<Record<string, never>>;
type CompanyRecord = Prisma.CompanyGetPayload<Record<string, never>>;

type ResourceArrayField =
	| "stages"
	| "communities"
	| "sectors"
	| "goals"
	| "regions"
	| "businessTypes"
	| "eligibilityTags";

type ResourceFitCategory =
	| "First-step support"
	| "Mentorship and community"
	| "Funding and capital"
	| "Incubator and workspace"
	| "Founder-specific support"
	| "Regional business support"
	| "Growth support"
	| "General startup support";

const STOP_WORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"for",
	"in",
	"like",
	"me",
	"of",
	"or",
	"stage",
	"the",
	"there",
	"to",
	"what",
	"with",
]);

const STAGE_ALIASES: Record<string, string[]> = {
	"early stage": [
		"IDEA",
		"PRE_REVENUE",
		"EARLY_REVENUE",
		"Idea",
		"Pre-Revenue",
		"Early Revenue",
		"early stage",
		"early-stage",
		"pre-seed",
		"pre seed",
		"startup",
		"startups",
		"founder",
		"founders",
		"entrepreneur",
		"entrepreneurs",
		"launch",
		"Start a Business",
	],
	idea: [
		"IDEA",
		"Idea",
		"idea",
		"pre-idea",
		"pre idea",
		"aspiring entrepreneur",
		"aspiring entrepreneurs",
		"Start a Business",
	],
	"pre revenue": [
		"PRE_REVENUE",
		"Pre-Revenue",
		"pre revenue",
		"pre-revenue",
		"early stage",
		"early-stage",
		"launch",
		"Start a Business",
	],
	"early revenue": [
		"EARLY_REVENUE",
		"Early Revenue",
		"early revenue",
		"early-revenue",
		"early stage",
		"startup",
	],
	seed: ["SEED", "Seed", "seed", "pre-seed", "pre seed", "early stage"],
};

const GOAL_ALIASES: Record<string, string[]> = {
	capital: ["Funding", "Capital", "funding", "financing", "investment"],
	"customer discovery": [
		"Start a Business",
		"Marketing and Sales",
		"customer discovery",
		"customers",
		"market validation",
	],
	education: ["Education", "Start a Business", "training", "workshops"],
	funding: ["Funding", "Capital", "funding", "financing", "investment"],
	mentoring: [
		"Mentorship",
		"Entrepreneurship Communities",
		"mentoring",
		"mentor",
		"mentors",
	],
	mentor: [
		"Mentorship",
		"Entrepreneurship Communities",
		"mentor",
		"mentoring",
		"mentors",
	],
	mentorship: [
		"Mentorship",
		"Entrepreneurship Communities",
		"mentorship",
		"mentoring",
		"mentor",
		"mentors",
	],
	"start a business": [
		"Start a Business",
		"Entrepreneurship Communities",
		"startup",
		"launch",
		"business plan",
		"business planning",
	],
	"business planning": [
		"Start a Business",
		"Education",
		"business plan",
		"business planning",
		"planning",
	],
};

const KEYWORD_ALIASES: Record<string, string[]> = {
	accelerator: ["accelerator", "incubator", "cohort", "program"],
	incubator: ["incubator", "accelerator", "workspace", "launchpad"],
	investor: ["investor", "investment", "venture", "capital", "funding"],
	mentor: ["mentor", "mentors", "mentoring", "mentorship", "advising"],
	mentorship: ["mentorship", "mentoring", "mentor", "advising"],
	startup: ["startup", "startups", "entrepreneur", "entrepreneurs", "founder"],
	vc: ["venture", "capital", "investment", "funding"],
};

const STAGE_TEXT_TERMS: Record<string, string[]> = {
	"early stage": [
		"early stage",
		"early-stage",
		"pre seed",
		"pre-seed",
		"pre revenue",
		"pre-revenue",
		"early revenue",
		"idea",
		"launch",
		"validated business ideas",
		"start a business",
	],
	idea: [
		"idea",
		"pre idea",
		"pre-idea",
		"aspiring entrepreneur",
		"aspiring entrepreneurs",
		"start a business",
	],
	"pre revenue": [
		"pre revenue",
		"pre-revenue",
		"early stage",
		"early-stage",
		"launch",
		"start a business",
	],
	"early revenue": ["early revenue", "early-revenue", "early stage"],
	seed: ["seed", "pre seed", "pre-seed", "early stage"],
};

const FIRST_STOP_TERMS = [
	"1 million cups",
	"1mc",
	"business resource center",
	"first step entrepreneur",
	"fstep",
	"ihub",
	"sbdc",
	"small business development center",
	"the mill",
	"startup training",
];

function containsInsensitive(value: string): Prisma.StringFilter {
	return { contains: value, mode: "insensitive" };
}

function trimText(value: string | null | undefined, limit: number) {
	const trimmed = value?.replace(/\s+/g, " ").trim();
	if (!trimmed) return undefined;
	return trimmed.length > limit ? `${trimmed.slice(0, limit - 3)}...` : trimmed;
}

function normalizeSet(values: string[]) {
	return new Set(
		values.map((value) => normalizeSearchKey(value)).filter(Boolean),
	);
}

function normalizeSearchKey(value: string) {
	return value
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[_-]+/g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function uniqueValues(values: string[]) {
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const value of values) {
		const key = normalizeSearchKey(value);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		unique.push(value.trim());
	}
	return unique;
}

function expandAliasValue(value: string, aliases: Record<string, string[]>[]) {
	const key = normalizeSearchKey(value);
	return uniqueValues([
		value,
		key,
		...aliases.flatMap((aliasMap) => aliasMap[key] ?? []),
	]);
}

function expandKeywordTerms(value: string | undefined) {
	if (!value) return [];
	const normalized = normalizeSearchKey(value);
	const tokens = normalized
		.split(" ")
		.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
	return uniqueValues([
		normalized,
		...tokens,
		...expandAliasValue(normalized, [
			STAGE_ALIASES,
			GOAL_ALIASES,
			KEYWORD_ALIASES,
		]),
		...tokens.flatMap((token) =>
			expandAliasValue(token, [GOAL_ALIASES, KEYWORD_ALIASES]),
		),
	]).slice(0, 18);
}

function compactSearchTerms(values: string[]) {
	return uniqueValues(values).filter(
		(value) => normalizeSearchKey(value).length > 2,
	);
}

function intersect(
	source: string[],
	target: string[],
	aliases: Record<string, string[]>[] = [],
) {
	const expandedTargetSet = normalizeSet(
		target.flatMap((value) => expandAliasValue(value, aliases)),
	);
	return source.filter((value) =>
		expandedTargetSet.has(normalizeSearchKey(value)),
	);
}

function matchRegions(source: string[], target: string[]) {
	const matchedRegions = intersect(source, target);
	if (matchedRegions.length || target.length === 0) return matchedRegions;
	return source.filter((value) =>
		["statewide", "utah"].includes(normalizeSearchKey(value)),
	);
}

function resourceSearchText(resource: ResourceRecord) {
	return normalizeSearchKey(
		[
			resource.name,
			resource.description,
			resource.shortDescription,
			resource.category,
			resource.subcategory,
			resource.city,
			resource.county,
			...resource.stages,
			...resource.communities,
			...resource.sectors,
			...resource.goals,
			...resource.regions,
			...resource.businessTypes,
			...resource.eligibilityTags,
		]
			.filter(Boolean)
			.join(" "),
	);
}

function matchedKeywordTerms(resource: ResourceRecord, keywords?: string) {
	const terms = expandKeywordTerms(keywords);
	if (terms.length === 0) return [];
	const searchText = resourceSearchText(resource);
	return terms.filter((term) => searchText.includes(normalizeSearchKey(term)));
}

function matchesResourceStage(resource: ResourceRecord, stage?: string) {
	if (!stage) return false;
	const stageTerms = expandAliasValue(stage, [STAGE_ALIASES]);
	const stageSet = normalizeSet(stageTerms);
	const hasDirectStage = resource.stages.some((value) =>
		stageSet.has(normalizeSearchKey(value)),
	);
	if (hasDirectStage) return true;

	const text = resourceSearchText(resource);
	const textTerms = STAGE_TEXT_TERMS[normalizeSearchKey(stage)] ?? stageTerms;
	return textTerms.some((term) => {
		const normalized = normalizeSearchKey(term);
		return normalized.length > 3 && text.includes(normalized);
	});
}

function isEarlyFounderInput(input: McpRecommendResourcesInput) {
	const stage = input.stage ? normalizeSearchKey(input.stage) : "";
	return Boolean(
		stage.includes("early") ||
			stage.includes("idea") ||
			stage.includes("pre revenue") ||
			stage.includes("pre seed") ||
			intersect(
				["Start a Business", "Mentorship", "Education"],
				[...input.goals, ...input.fundingNeeds],
				[GOAL_ALIASES],
			).length,
	);
}

function firstStopBonus(
	resource: ResourceRecord,
	input: McpRecommendResourcesInput,
) {
	if (!isEarlyFounderInput(input)) return 0;
	const text = resourceSearchText(resource);
	return FIRST_STOP_TERMS.some((term) => text.includes(term)) ? 14 : 0;
}

function formatStageLabel(stage: string) {
	const label = stage.replace(/_/g, " ").toLowerCase();
	return label.endsWith("stage") ? label : `${label} stage`;
}

function resourceTextClauses(terms: string[]) {
	return compactSearchTerms(terms).flatMap<Prisma.ResourceWhereInput>(
		(term) => [
			{ name: containsInsensitive(term) },
			{ description: containsInsensitive(term) },
			{ shortDescription: containsInsensitive(term) },
			{ websiteUrl: containsInsensitive(term) },
			{ category: containsInsensitive(term) },
			{ subcategory: containsInsensitive(term) },
			{ city: containsInsensitive(term) },
			{ county: containsInsensitive(term) },
			{ communities: { has: term } },
			{ sectors: { has: term } },
			{ goals: { has: term } },
			{ regions: { has: term } },
			{ businessTypes: { has: term } },
			{ eligibilityTags: { has: term } },
		],
	);
}

function resourceArrayClause(field: ResourceArrayField, values: string[]) {
	return {
		[field]: { hasSome: uniqueValues(values) },
	} as Prisma.ResourceWhereInput;
}

function resourceFilterClauses(
	field: ResourceArrayField,
	value: string | undefined,
	aliases: Record<string, string[]>[] = [],
) {
	if (!value) return [];
	const terms = expandAliasValue(value, aliases);
	return [resourceArrayClause(field, terms), ...resourceTextClauses(terms)];
}

function buildReference(
	kind: AgentReference["kind"],
	input: {
		id: string;
		title: string;
		href: string;
		subtitle?: string | null;
		excerpt?: string | null;
		section?: string;
		sourceId?: string;
		sourceSlug?: string;
		sourceTable?: string;
		sourceField?: string;
		toolName?: string;
		score?: number;
		reasons?: string[];
	},
): AgentReference {
	return {
		id: input.id,
		kind,
		sourceId: input.sourceId,
		sourceSlug: input.sourceSlug,
		title: input.title,
		subtitle: trimText(input.subtitle, 240),
		excerpt: trimText(input.excerpt, 600),
		href: input.href,
		section: input.section,
		sourceTable: input.sourceTable,
		sourceField: input.sourceField,
		toolName: input.toolName,
		score: input.score,
		reasons: input.reasons?.slice(0, 6),
	};
}

function createResourceReference(input: {
	resource: Pick<
		ResourceRecord,
		"id" | "slug" | "name" | "shortDescription" | "description" | "category"
	>;
	toolName: string;
	section?: string;
	score?: number;
	reasons?: string[];
}) {
	return buildReference("resource", {
		id: `resource:${input.resource.id}${input.section ? `:${input.section}` : ""}`,
		sourceId: input.resource.id,
		sourceSlug: input.resource.slug,
		title: input.resource.name,
		subtitle: input.resource.category,
		excerpt: input.resource.shortDescription ?? input.resource.description,
		href: `/resources/${input.resource.id}${input.section ? `#${input.section}` : ""}`,
		section: input.section,
		sourceTable: "Resource",
		sourceField: input.section ?? "overview",
		toolName: input.toolName,
		score: input.score,
		reasons: input.reasons,
	});
}

function createCompanyReference(input: {
	company: Pick<
		CompanyRecord,
		| "id"
		| "slug"
		| "name"
		| "description"
		| "sector"
		| "stage"
		| "city"
		| "county"
	>;
	toolName: string;
	section?: string;
}) {
	const location = [input.company.city, input.company.county]
		.filter(Boolean)
		.join(", ");
	return buildReference("company", {
		id: `company:${input.company.id}${input.section ? `:${input.section}` : ""}`,
		sourceId: input.company.id,
		sourceSlug: input.company.slug,
		title: input.company.name,
		subtitle: [input.company.sector, input.company.stage, location]
			.filter(Boolean)
			.join(" - "),
		excerpt: input.company.description,
		href: `/companies/${input.company.id}${input.section ? `#${input.section}` : ""}`,
		section: input.section,
		sourceTable: "Company",
		sourceField: input.section ?? "overview",
		toolName: input.toolName,
	});
}

function createSearchReference(input: {
	kind: "resource_search" | "map_search";
	idPrefix: string;
	title: string;
	excerpt: string;
	path: string;
	params: Record<string, string | number | undefined>;
	toolName: string;
}) {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(input.params)) {
		if (value !== undefined && value !== "") search.set(key, String(value));
	}
	const query = search.toString();
	return buildReference(input.kind, {
		id: `${input.idPrefix}:${query || "all"}`,
		title: input.title,
		excerpt: input.excerpt,
		href: `${input.path}${query ? `?${query}` : ""}`,
		toolName: input.toolName,
	});
}

function compactResource(resource: ResourceRecord) {
	return {
		id: resource.id,
		slug: resource.slug,
		name: resource.name,
		description: trimText(
			resource.shortDescription ?? resource.description,
			360,
		),
		category: resource.category,
		subcategory: resource.subcategory,
		stages: resource.stages.slice(0, 6),
		communities: resource.communities.slice(0, 6),
		sectors: resource.sectors.slice(0, 6),
		goals: resource.goals.slice(0, 6),
		regions: resource.regions.slice(0, 6),
		businessTypes: resource.businessTypes.slice(0, 6),
		eligibilityTags: resource.eligibilityTags.slice(0, 6),
		location: [resource.city, resource.county].filter(Boolean).join(", "),
		websiteUrl: resource.websiteUrl,
	};
}

function compactCompany(company: CompanyRecord) {
	return {
		id: company.id,
		slug: company.slug,
		name: company.name,
		description: company.description,
		sector: company.sector,
		stage: company.stage,
		employeeRange: company.employeeRange,
		employees: company.employees,
		yearFounded: company.yearFounded,
		location: [company.city, company.county].filter(Boolean).join(", "),
		hiringStatus: company.hiringStatus,
		websiteUrl: company.websiteUrl,
	};
}

function buildResourceWhere(
	input: McpSearchResourcesInput,
): Prisma.ResourceWhereInput {
	const where: Prisma.ResourceWhereInput = { status: "PUBLISHED" };
	const andClauses: Prisma.ResourceWhereInput[] = [];

	if (input.q) {
		const clauses = resourceTextClauses(expandKeywordTerms(input.q));
		if (clauses.length) andClauses.push({ OR: clauses });
	}

	for (const clauses of [
		resourceFilterClauses("stages", input.stage, [STAGE_ALIASES]),
		resourceFilterClauses("sectors", input.sector),
		resourceFilterClauses("goals", input.goal, [GOAL_ALIASES]),
		resourceFilterClauses("regions", input.region),
		resourceFilterClauses("businessTypes", input.businessType),
	]) {
		if (clauses.length) andClauses.push({ OR: clauses });
	}

	if (andClauses.length) where.AND = andClauses;

	return where;
}

function searchProfileFromInput(
	input: McpSearchResourcesInput,
): McpRecommendResourcesInput {
	return {
		stage: input.stage,
		region: input.region,
		sectors: input.sector ? [input.sector] : [],
		goals: input.goal ? [input.goal] : [],
		businessTypes: input.businessType ? [input.businessType] : [],
		fundingNeeds: [],
		founderIdentities: [],
		keywords: input.q,
		limit: input.limit,
	};
}

function fitCategoryForResource(
	resource: ResourceRecord,
	input: McpRecommendResourcesInput,
): ResourceFitCategory {
	const text = resourceSearchText(resource);
	const goals = normalizeSet(resource.goals);
	const eligibility = normalizeSet(resource.eligibilityTags);
	const requestedFounderIdentity = input.founderIdentities.length > 0;

	if (
		requestedFounderIdentity &&
		resource.eligibilityTags.some(
			(tag) => intersect([tag], input.founderIdentities).length,
		)
	) {
		return "Founder-specific support";
	}

	if (
		eligibility.size > 0 &&
		!["none of these", "prefer not to say"].some((neutralIdentity) =>
			eligibility.has(neutralIdentity),
		)
	) {
		return "Founder-specific support";
	}

	if (FIRST_STOP_TERMS.some((term) => text.includes(term))) {
		return "First-step support";
	}

	if (
		["incubator", "accelerator", "workspace", "office space", "lab space"].some(
			(term) => text.includes(term),
		)
	) {
		return "Incubator and workspace";
	}

	if (
		["mentor", "mentoring", "mentorship", "community", "networking"].some(
			(term) => text.includes(term),
		) ||
		goals.has("entrepreneurship communities")
	) {
		return "Mentorship and community";
	}

	if (
		["funding", "capital", "venture", "investment", "grant", "sbir"].some(
			(term) => text.includes(term),
		) ||
		goals.has("funding") ||
		goals.has("capital")
	) {
		return "Funding and capital";
	}

	if (
		["idea", "aspiring", "start a business", "business plan", "launch"].some(
			(term) => text.includes(term),
		) ||
		goals.has("start a business")
	) {
		return "First-step support";
	}

	if (
		["late stage", "scale", "growth", "export", "international trade"].some(
			(term) => text.includes(term),
		)
	) {
		return "Growth support";
	}

	if (resource.regions.length || resource.county || resource.city) {
		return "Regional business support";
	}

	return "General startup support";
}

function dedupeRecommendations<
	T extends { resource: ResourceRecord; score: number },
>(recommendations: T[]) {
	const byKey = new Map<string, T>();
	for (const recommendation of recommendations) {
		const websiteKey = recommendation.resource.websiteUrl
			? normalizeSearchKey(recommendation.resource.websiteUrl)
			: undefined;
		const key = websiteKey || normalizeSearchKey(recommendation.resource.name);
		const current = byKey.get(key);
		if (!current || recommendation.score > current.score) {
			byKey.set(key, recommendation);
		}
	}
	return [...byKey.values()];
}

function groupRecommendations<
	T extends { resource: ResourceRecord; score: number; fitCategory: string },
>(recommendations: T[]) {
	const groups = new Map<string, T[]>();
	for (const recommendation of recommendations) {
		const group = groups.get(recommendation.fitCategory) ?? [];
		group.push(recommendation);
		groups.set(recommendation.fitCategory, group);
	}
	return [...groups.entries()].map(([name, items]) => ({
		name,
		items: items.slice(0, 4).map((item) => ({
			id: item.resource.id,
			slug: item.resource.slug,
			name: item.resource.name,
			score: item.score,
		})),
	}));
}

function hasResourceSearchIntent(input: McpSearchResourcesInput) {
	return Boolean(
		input.q ||
			input.stage ||
			input.sector ||
			input.goal ||
			input.region ||
			input.businessType,
	);
}

function scoreSearchResource(
	resource: ResourceRecord,
	input: McpSearchResourcesInput,
) {
	const profile = searchProfileFromInput(input);
	const recommendation = scoreResource(resource, profile);
	const keywordTerms = matchedKeywordTerms(resource, input.q);
	const score = Math.min(
		100,
		recommendation.score + Math.min(keywordTerms.length, 5) * 6,
	);
	const reasons = uniqueValues([
		...recommendation.reasons,
		...(keywordTerms.length
			? [`Matches ${keywordTerms.slice(0, 3).join(", ")}.`]
			: []),
	]);

	return {
		...recommendation,
		score,
		reasons,
		fitCategory: fitCategoryForResource(resource, profile),
	};
}

async function findResourceSearchMatches(
	db: DbClient,
	input: McpSearchResourcesInput,
) {
	const where = buildResourceWhere(input);
	const take = Math.max(input.limit * 6, 36);
	const [items, total] = await Promise.all([
		db.resource.findMany({
			where,
			orderBy: { updatedAt: "desc" },
			take,
		}),
		db.resource.count({ where }),
	]);

	if (items.length || !hasResourceSearchIntent(input)) {
		return { items, total, fallback: false };
	}

	const fallbackItems = await db.resource.findMany({
		where: { status: "PUBLISHED" },
		orderBy: { updatedAt: "desc" },
		take: 200,
	});
	const rankedFallbackItems = dedupeRecommendations(
		fallbackItems
			.map((resource) => scoreSearchResource(resource, input))
			.filter((recommendation) => recommendation.score > 0),
	);

	return {
		items: rankedFallbackItems.map((recommendation) => recommendation.resource),
		total: rankedFallbackItems.length,
		fallback: true,
	};
}

function buildCompanyWhere(
	input: McpSearchCompaniesInput,
): Prisma.CompanyWhereInput {
	const where: Prisma.CompanyWhereInput = { status: "PUBLISHED" };

	if (input.q) {
		where.OR = [
			{ name: containsInsensitive(input.q) },
			{ description: containsInsensitive(input.q) },
			{ sector: containsInsensitive(input.q) },
			{ city: containsInsensitive(input.q) },
			{ county: containsInsensitive(input.q) },
		];
	}

	if (input.sector)
		where.sector = { equals: input.sector, mode: "insensitive" };
	if (input.stage) where.stage = { equals: input.stage, mode: "insensitive" };
	if (input.hiringStatus) where.hiringStatus = input.hiringStatus;
	if (input.city) where.city = { equals: input.city, mode: "insensitive" };
	if (input.county)
		where.county = { equals: input.county, mode: "insensitive" };
	if (input.employeeMin !== undefined || input.employeeMax !== undefined) {
		where.employees = {
			...(input.employeeMin !== undefined ? { gte: input.employeeMin } : {}),
			...(input.employeeMax !== undefined ? { lte: input.employeeMax } : {}),
		};
	}

	return where;
}

function scoreResource(
	resource: ResourceRecord,
	input: McpRecommendResourcesInput,
) {
	const matchedGoals = intersect(
		resource.goals,
		[...input.goals, ...input.fundingNeeds],
		[GOAL_ALIASES],
	);
	const matchedSectors = intersect(resource.sectors, input.sectors);
	const matchedRegions = matchRegions(
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
	const stageMatch = matchesResourceStage(resource, input.stage);
	const keywordTerms = matchedKeywordTerms(resource, input.keywords);
	const keywordMatch = keywordTerms.length > 0;
	const fitCategory = fitCategoryForResource(resource, input);
	const firstStopScore = firstStopBonus(resource, input);

	const score = Math.min(
		100,
		(stageMatch ? 30 : 0) +
			(matchedGoals.length > 0
				? 25 + Math.min(matchedGoals.length - 1, 3) * 3
				: 0) +
			(matchedSectors.length > 0 ? 15 : 0) +
			(matchedRegions.length > 0 ? 15 : 0) +
			(matchedBusinessTypes.length > 0 ? 10 : 0) +
			(matchedFounderIdentities.length > 0 ? 12 : 0) +
			(keywordMatch ? 8 + Math.min(keywordTerms.length - 1, 4) * 2 : 0) +
			(firstStopScore > 0 ? firstStopScore : 0) +
			(fitCategory === "General startup support" ? 0 : 4),
	);

	const reasons = [
		stageMatch && input.stage
			? `Fits founders around the ${formatStageLabel(input.stage)}.`
			: null,
		firstStopScore > 0 ? "Strong first stop for early founder guidance." : null,
		matchedGoals.length
			? `Useful for ${matchedGoals.slice(0, 3).join(", ")}.`
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
		keywordMatch
			? `Matches intent around ${keywordTerms.slice(0, 3).join(", ")}.`
			: null,
	].filter(Boolean) as string[];

	return {
		resource,
		score,
		fitCategory,
		reasons: reasons.length
			? reasons
			: ["A broad Utah startup resource worth reviewing."],
	};
}

export const searchResourcesTool: McpToolImplementation<McpSearchResourcesInput> =
	{
		contract: mcpToolContracts.search_resources,
		async execute(input, context) {
			const searchResult = await findResourceSearchMatches(context.db, input);
			const hasIntent = hasResourceSearchIntent(input);
			const rankedItems = hasIntent
				? dedupeRecommendations(
						searchResult.items.map((resource) =>
							scoreSearchResource(resource, input),
						),
					)
						.sort(
							(left, right) =>
								right.score - left.score ||
								left.resource.name.localeCompare(right.resource.name),
						)
						.slice(0, input.limit)
				: searchResult.items.slice(0, input.limit).map((resource) => ({
						resource,
						score: 0,
						fitCategory: fitCategoryForResource(
							resource,
							searchProfileFromInput(input),
						),
						reasons: ["Recent published startup resource."],
					}));

			return schemaEnvelope("resources.search", {
				items: rankedItems.map((item) => ({
					...compactResource(item.resource),
					score: item.score,
					fitCategory: item.fitCategory,
					reasons: item.reasons,
				})),
				total: searchResult.total,
				query: {
					usedFallback: searchResult.fallback,
					expandedTerms: expandKeywordTerms(input.q).slice(0, 10),
				},
				groups: groupRecommendations(rankedItems),
				references: [
					...rankedItems.map((item) =>
						createResourceReference({
							resource: item.resource,
							toolName: "search_resources",
							score: item.score,
							reasons: item.reasons,
						}),
					),
					createSearchReference({
						kind: "resource_search",
						idPrefix: "resource-search",
						title: "Open resource search",
						excerpt: "Open this filtered resource search.",
						path: "/resources",
						params: input,
						toolName: "search_resources",
					}),
				],
			});
		},
	};

export const getResourceTool: McpToolImplementation<McpGetByIdOrSlugInput> = {
	contract: mcpToolContracts.get_resource,
	async execute(input, context) {
		const resource = await context.db.resource.findFirst({
			where: {
				...(input.id ? { id: input.id } : { slug: input.slug }),
				status: "PUBLISHED",
			},
		});
		if (!resource) throw new Error("Resource not found");

		const relatedWhere: Prisma.ResourceWhereInput = {
			id: { not: resource.id },
			status: "PUBLISHED",
		};
		const relatedSignals: Prisma.ResourceWhereInput[] = [
			...(resource.category ? [{ category: resource.category }] : []),
			...(resource.goals.length
				? [{ goals: { hasSome: resource.goals } }]
				: []),
			...(resource.sectors.length
				? [{ sectors: { hasSome: resource.sectors } }]
				: []),
		];
		if (relatedSignals.length) relatedWhere.OR = relatedSignals;
		const related = await context.db.resource.findMany({
			where: relatedWhere,
			orderBy: { updatedAt: "desc" },
			take: 3,
		});

		return schemaEnvelope("resources.get", {
			resource: compactResource(resource),
			related: related.map(compactResource),
			references: [
				createResourceReference({ resource, toolName: "get_resource" }),
				createResourceReference({
					resource,
					toolName: "get_resource",
					section: "resource-fit",
				}),
				createResourceReference({
					resource,
					toolName: "get_resource",
					section: "resource-contact",
				}),
			],
		});
	},
};

export const recommendResourcesTool: McpToolImplementation<McpRecommendResourcesInput> =
	{
		contract: mcpToolContracts.recommend_resources,
		async execute(input, context) {
			const resources = await context.db.resource.findMany({
				where: { status: "PUBLISHED" },
				orderBy: { updatedAt: "desc" },
				take: 300,
			});
			const recommendations = dedupeRecommendations(
				resources.map((resource) => scoreResource(resource, input)),
			)
				.sort(
					(left, right) =>
						right.score - left.score ||
						left.resource.name.localeCompare(right.resource.name),
				)
				.slice(0, input.limit);

			return schemaEnvelope("resources.recommend", {
				recommendations: recommendations.map((recommendation) => ({
					resource: compactResource(recommendation.resource),
					score: recommendation.score,
					fitCategory: recommendation.fitCategory,
					reasons: recommendation.reasons,
				})),
				query: {
					stageTerms: input.stage
						? expandAliasValue(input.stage, [STAGE_ALIASES]).slice(0, 10)
						: [],
					expandedTerms: expandKeywordTerms(input.keywords).slice(0, 10),
				},
				groups: groupRecommendations(recommendations),
				references: [
					...recommendations.map((recommendation) =>
						createResourceReference({
							resource: recommendation.resource,
							toolName: "recommend_resources",
							score: recommendation.score,
							reasons: recommendation.reasons,
						}),
					),
					buildReference("founder_intake", {
						id: "founder-intake",
						title: "Founder intake",
						excerpt:
							"Answer a short intake to get more targeted resource matches.",
						href: "/founder",
						toolName: "recommend_resources",
					}),
				],
			});
		},
	};

export const searchCompaniesTool: McpToolImplementation<McpSearchCompaniesInput> =
	{
		contract: mcpToolContracts.search_companies,
		async execute(input, context) {
			const where = buildCompanyWhere(input);
			const [items, total] = await Promise.all([
				context.db.company.findMany({
					where,
					orderBy: { updatedAt: "desc" },
					take: input.limit,
				}),
				context.db.company.count({ where }),
			]);

			return schemaEnvelope("companies.search", {
				items: items.map(compactCompany),
				total,
				references: [
					...items.map((company) =>
						createCompanyReference({
							company,
							toolName: "search_companies",
						}),
					),
					createSearchReference({
						kind: "map_search",
						idPrefix: "map-search",
						title: "Open company map search",
						excerpt: "Open this company view on the ecosystem map.",
						path: "/map",
						params: input,
						toolName: "search_companies",
					}),
				],
			});
		},
	};

export const getCompanyTool: McpToolImplementation<McpGetByIdOrSlugInput> = {
	contract: mcpToolContracts.get_company,
	async execute(input, context) {
		const company = await context.db.company.findFirst({
			where: {
				...(input.id ? { id: input.id } : { slug: input.slug }),
				status: "PUBLISHED",
			},
		});
		if (!company) throw new Error("Company not found");

		const relatedWhere: Prisma.CompanyWhereInput = {
			id: { not: company.id },
			status: "PUBLISHED",
		};
		const relatedSignals: Prisma.CompanyWhereInput[] = [
			...(company.sector ? [{ sector: company.sector }] : []),
			...(company.city ? [{ city: company.city }] : []),
			...(company.county ? [{ county: company.county }] : []),
		];
		if (relatedSignals.length) relatedWhere.OR = relatedSignals;
		const related = await context.db.company.findMany({
			where: relatedWhere,
			orderBy: { updatedAt: "desc" },
			take: 3,
		});

		return schemaEnvelope("companies.get", {
			company: compactCompany(company),
			related: related.map(compactCompany),
			references: [
				createCompanyReference({ company, toolName: "get_company" }),
				createCompanyReference({
					company,
					toolName: "get_company",
					section: "company-details",
				}),
				createCompanyReference({
					company,
					toolName: "get_company",
					section: "company-map",
				}),
			],
		});
	},
};
