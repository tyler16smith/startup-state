import { z } from "zod";
import { db } from "~/server/db";
import {
	getCompanyById,
	searchCompanies,
} from "~/server/services/startup-navigator/companies";
import {
	getResourceById,
	recommendResourcesForFounderProfile,
	searchRelevantResources,
} from "~/server/services/startup-navigator/resources";
import { hiringStatusSchema } from "~/server/services/startup-navigator/schemas";
import {
	createCompanyReference,
	createFounderIntakeReference,
	createMapSearchReference,
	createResourceReference,
	createResourceSearchReference,
} from "../references";
import type { FinToolDefinition } from "./types";

const limitSchema = z.number().int().min(1).max(8).default(5);

const searchResourcesInputSchema = z.object({
	q: z.string().min(1).max(120).optional(),
	stage: z.string().min(1).max(80).optional(),
	sector: z.string().min(1).max(80).optional(),
	goal: z.string().min(1).max(80).optional(),
	region: z.string().min(1).max(80).optional(),
	businessType: z.string().min(1).max(80).optional(),
	limit: limitSchema,
});

const getByIdOrSlugInputSchema = z.object({
	id: z.string().min(1).max(220).optional(),
	slug: z.string().min(1).max(220).optional(),
});

const founderRecommendationInputSchema = z.object({
	stage: z.string().optional(),
	city: z.string().optional(),
	county: z.string().optional(),
	region: z.string().optional(),
	sectors: z.array(z.string()).default([]),
	goals: z.array(z.string()).default([]),
	businessTypes: z.array(z.string()).default([]),
	fundingNeeds: z.array(z.string()).default([]),
	hiringStatus: z.string().optional(),
	keywords: z.string().optional(),
	limit: limitSchema,
});

const searchCompaniesInputSchema = z.object({
	q: z.string().min(1).max(120).optional(),
	sector: z.string().min(1).max(80).optional(),
	stage: z.string().min(1).max(80).optional(),
	hiringStatus: hiringStatusSchema.optional(),
	employeeMin: z.number().int().min(0).optional(),
	employeeMax: z.number().int().min(0).optional(),
	city: z.string().min(1).max(80).optional(),
	county: z.string().min(1).max(80).optional(),
	limit: limitSchema,
});

function requireIdentifier(input: { id?: string; slug?: string }) {
	if (input.id || input.slug) return;
	throw new Error("Provide an id or slug.");
}

function compactResource(resource: {
	id: string;
	name: string;
	description: string;
	shortDescription?: string | null;
	category?: string | null;
	stages: string[];
	sectors: string[];
	goals: string[];
	regions: string[];
	businessTypes: string[];
	eligibilityTags: string[];
	city?: string | null;
	county?: string | null;
}) {
	return {
		id: resource.id,
		name: resource.name,
		description: resource.shortDescription ?? resource.description,
		category: resource.category,
		stages: resource.stages.slice(0, 6),
		sectors: resource.sectors.slice(0, 6),
		goals: resource.goals.slice(0, 6),
		regions: resource.regions.slice(0, 6),
		businessTypes: resource.businessTypes.slice(0, 6),
		eligibilityTags: resource.eligibilityTags.slice(0, 6),
		location: [resource.city, resource.county].filter(Boolean).join(", "),
	};
}

function compactCompany(company: {
	id: string;
	name: string;
	description?: string | null;
	sector?: string | null;
	stage?: string | null;
	employeeRange?: string | null;
	employees?: number | null;
	yearFounded?: number | null;
	city?: string | null;
	county?: string | null;
	hiringStatus: string;
}) {
	return {
		id: company.id,
		name: company.name,
		description: company.description,
		sector: company.sector,
		stage: company.stage,
		employeeRange: company.employeeRange,
		employees: company.employees,
		yearFounded: company.yearFounded,
		location: [company.city, company.county].filter(Boolean).join(", "),
		hiringStatus: company.hiringStatus,
	};
}

export const searchResourcesTool: FinToolDefinition<
	z.infer<typeof searchResourcesInputSchema>
> = {
	name: "search_resources",
	displayName: "Search resources",
	description:
		"Search published customer-facing startup resources by keyword, founder stage, sector, goal, region, and business type. Return clickable references for resources and the filtered resource search page.",
	enabled: true,
	capabilities: ["read:app"],
	safetyClass: "read_only_app_data",
	inputSchema: searchResourcesInputSchema,
	execute: async (input, context) => {
		const result = await searchRelevantResources(
			db,
			{ ...input, limit: input.limit, sort: "recent" },
			{ userId: context.userId },
		);
		const resourceReferences = result.items.map((resource) =>
			createResourceReference({
				resource,
				toolName: "search_resources",
			}),
		);
		return {
			items: result.items.map(compactResource),
			total: result.total,
			references: [
				...resourceReferences,
				createResourceSearchReference({
					title: "Open resource search",
					params: input,
					toolName: "search_resources",
				}),
			],
		};
	},
};

export const getResourceTool: FinToolDefinition<
	z.infer<typeof getByIdOrSlugInputSchema>
> = {
	name: "get_resource",
	displayName: "Get resource",
	description:
		"Fetch one published startup resource by id or slug and return clickable references to its page sections.",
	enabled: true,
	capabilities: ["read:app"],
	safetyClass: "read_only_app_data",
	inputSchema: getByIdOrSlugInputSchema,
	execute: async (input, context) => {
		requireIdentifier(input);
		const resource = await getResourceById(
			db,
			input.id ? { id: input.id } : { slug: input.slug },
			{ userId: context.userId },
		);
		return {
			resource: compactResource(resource),
			related: resource.related?.map(compactResource) ?? [],
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
		};
	},
};

export const recommendFounderResourcesTool: FinToolDefinition<
	z.infer<typeof founderRecommendationInputSchema>
> = {
	name: "recommend_founder_resources",
	displayName: "Recommend resources",
	description:
		"Recommend published startup resources for a founder based on stage, sector, goals, funding needs, business type, region, and keywords. Return reasons and clickable resource references.",
	enabled: true,
	capabilities: ["read:app"],
	safetyClass: "read_only_app_data",
	inputSchema: founderRecommendationInputSchema,
	execute: async (input, context) => {
		const { limit, ...profile } = input;
		const result = await recommendResourcesForFounderProfile(db, profile, {
			userId: context.userId,
			persistProfile: false,
		});
		const recommendations = result.recommendations.slice(0, limit);
		return {
			recommendations: recommendations.map((recommendation) => ({
				resource: compactResource(recommendation.resource),
				score: recommendation.score,
				reasons: recommendation.reasons,
			})),
			references: [
				...recommendations.map((recommendation) =>
					createResourceReference({
						resource: recommendation.resource,
						toolName: "recommend_founder_resources",
						score: recommendation.score,
						reasons: recommendation.reasons,
					}),
				),
				createFounderIntakeReference("recommend_founder_resources"),
			],
		};
	},
};

export const searchCompaniesTool: FinToolDefinition<
	z.infer<typeof searchCompaniesInputSchema>
> = {
	name: "search_companies",
	displayName: "Search companies",
	description:
		"Search published customer-facing company profiles by keyword, sector, stage, hiring status, employee range, city, or county. Useful for investors exploring companies building here.",
	enabled: true,
	capabilities: ["read:app"],
	safetyClass: "read_only_app_data",
	inputSchema: searchCompaniesInputSchema,
	execute: async (input) => {
		const result = await searchCompanies(db, {
			...input,
			limit: input.limit,
			sort: "recent",
		});
		return {
			items: result.items.map(compactCompany),
			total: result.total,
			references: [
				...result.items.map((company) =>
					createCompanyReference({
						company,
						toolName: "search_companies",
					}),
				),
				createMapSearchReference({
					title: "Open company map search",
					params: input,
					toolName: "search_companies",
				}),
			],
		};
	},
};

export const getCompanyTool: FinToolDefinition<
	z.infer<typeof getByIdOrSlugInputSchema>
> = {
	name: "get_company",
	displayName: "Get company",
	description:
		"Fetch one published company profile by id or slug and return clickable references to its public profile sections.",
	enabled: true,
	capabilities: ["read:app"],
	safetyClass: "read_only_app_data",
	inputSchema: getByIdOrSlugInputSchema,
	execute: async (input) => {
		requireIdentifier(input);
		const company = await getCompanyById(
			db,
			input.id ? { id: input.id } : { slug: input.slug },
		);
		return {
			company: compactCompany(company),
			related: company.related?.map(compactCompany) ?? [],
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
		};
	},
};

export const startupNavigatorTools: Record<string, FinToolDefinition> = {
	search_resources: searchResourcesTool,
	get_resource: getResourceTool,
	recommend_founder_resources: recommendFounderResourcesTool,
	search_companies: searchCompaniesTool,
	get_company: getCompanyTool,
};
