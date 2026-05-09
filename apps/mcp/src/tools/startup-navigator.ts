import {
	type AgentReference,
	type McpGetByIdOrSlugInput,
	type McpRecommendResourcesInput,
	type McpSearchCompaniesInput,
	type McpSearchResourcesInput,
	mcpToolContracts,
} from "@app/mcp-contracts";
import type { Prisma } from "../../../api/generated/prisma/index.js";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

type ResourceRecord = Prisma.ResourceGetPayload<Record<string, never>>;
type CompanyRecord = Prisma.CompanyGetPayload<Record<string, never>>;

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
		values.map((value) => value.toLowerCase().trim()).filter(Boolean),
	);
}

function intersect(source: string[], target: string[]) {
	const sourceSet = normalizeSet(source);
	return target.filter((value) => sourceSet.has(value.toLowerCase().trim()));
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
		description: resource.shortDescription ?? resource.description,
		category: resource.category,
		subcategory: resource.subcategory,
		stages: resource.stages.slice(0, 6),
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

	if (input.q) {
		where.OR = [
			{ name: containsInsensitive(input.q) },
			{ description: containsInsensitive(input.q) },
			{ shortDescription: containsInsensitive(input.q) },
			{ websiteUrl: containsInsensitive(input.q) },
			{ category: containsInsensitive(input.q) },
			{ subcategory: containsInsensitive(input.q) },
			{ communities: { has: input.q } },
			{ sectors: { has: input.q } },
			{ goals: { has: input.q } },
			{ regions: { has: input.q } },
		];
	}

	if (input.stage) where.stages = { has: input.stage };
	if (input.sector) where.sectors = { has: input.sector };
	if (input.goal) where.goals = { has: input.goal };
	if (input.region) where.regions = { has: input.region };
	if (input.businessType) where.businessTypes = { has: input.businessType };

	return where;
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
		? [
				resource.name,
				resource.description,
				resource.shortDescription,
				resource.category,
				resource.subcategory,
			]
				.filter(Boolean)
				.join(" ")
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
			? `Fits the ${input.stage.replace(/_/g, " ").toLowerCase()} stage.`
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
		keywordMatch ? "Matches the search language." : null,
	].filter(Boolean) as string[];

	return {
		resource,
		score,
		reasons: reasons.length
			? reasons
			: ["A broad Utah startup resource worth reviewing."],
	};
}

export const searchResourcesTool: McpToolImplementation<McpSearchResourcesInput> =
	{
		contract: mcpToolContracts.search_resources,
		async execute(input, context) {
			const where = buildResourceWhere(input);
			const [items, total] = await Promise.all([
				context.db.resource.findMany({
					where,
					orderBy: { updatedAt: "desc" },
					take: input.limit,
				}),
				context.db.resource.count({ where }),
			]);

			return schemaEnvelope("resources.search", {
				items: items.map(compactResource),
				total,
				references: [
					...items.map((resource) =>
						createResourceReference({
							resource,
							toolName: "search_resources",
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
				take: 100,
			});
			const recommendations = resources
				.map((resource) => scoreResource(resource, input))
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
					reasons: recommendation.reasons,
				})),
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
