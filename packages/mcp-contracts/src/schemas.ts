import { z } from "zod";

export const emptyInputSchema = z.object({}).strict();

export const agentReferenceKindSchema = z.enum([
	"resource",
	"company",
	"url",
	"map_search",
	"resource_search",
	"founder_intake",
	"founder_results",
]);

export const agentReferenceSchema = z
	.object({
		id: z.string().min(1),
		kind: agentReferenceKindSchema,
		sourceId: z.string().min(1).optional(),
		sourceSlug: z.string().min(1).optional(),
		title: z.string().min(1).max(240),
		subtitle: z.string().max(240).optional(),
		excerpt: z.string().max(600).optional(),
		href: z.string().min(1).max(500).optional(),
		section: z.string().min(1).max(80).optional(),
		sourceTable: z.string().min(1).max(80).optional(),
		sourceField: z.string().min(1).max(80).optional(),
		toolName: z.string().min(1).max(120).optional(),
		score: z.number().optional(),
		reasons: z.array(z.string().min(1).max(240)).max(6).optional(),
	})
	.strict();

export const agentReferenceBlockSchema = z
	.object({
		id: z.string().min(1),
		title: z.string().min(1).max(160).optional(),
		toolCallId: z.string().min(1).optional(),
		toolName: z.string().min(1).max(120).optional(),
		references: z.array(agentReferenceSchema).min(1).max(12),
	})
	.strict();

export const profileInfoSchema = z
	.object({
		id: z.string(),
		name: z.string().nullable(),
		email: z.string().nullable(),
		hasCompletedInitialOnboarding: z.boolean(),
	})
	.strict();

export const supportDocumentationTopicSchema = z.enum([
	"getting_started",
	"founder_navigator",
	"investor_explorer",
	"resources",
	"map_and_companies",
	"ai_assistant",
	"account_settings",
	"mcp_access",
	"troubleshooting",
]);

export const supportDocumentationInputSchema = z
	.object({
		topic: supportDocumentationTopicSchema.optional(),
		query: z.string().trim().min(1).max(160).optional(),
	})
	.strict();

const mcpToolLimitSchema = z.number().int().min(1).max(8).default(5);
const mcpFilterValueSchema = z.string().trim().min(1).max(120);

export const mcpSearchResourcesInputSchema = z
	.object({
		q: z.string().trim().min(1).max(120).optional(),
		stage: mcpFilterValueSchema.optional(),
		sector: mcpFilterValueSchema.optional(),
		goal: mcpFilterValueSchema.optional(),
		region: mcpFilterValueSchema.optional(),
		businessType: mcpFilterValueSchema.optional(),
		limit: mcpToolLimitSchema,
	})
	.strict();

export const mcpGetByIdOrSlugInputSchema = z
	.object({
		id: z.string().trim().min(1).max(220).optional(),
		slug: z.string().trim().min(1).max(220).optional(),
	})
	.strict()
	.refine((input) => Boolean(input.id || input.slug), {
		message: "Provide either id or slug.",
	});

export const mcpRecommendResourcesInputSchema = z
	.object({
		stage: mcpFilterValueSchema.optional(),
		city: mcpFilterValueSchema.optional(),
		county: mcpFilterValueSchema.optional(),
		region: mcpFilterValueSchema.optional(),
		sectors: z.array(mcpFilterValueSchema).max(12).default([]),
		goals: z.array(mcpFilterValueSchema).max(12).default([]),
		businessTypes: z.array(mcpFilterValueSchema).max(12).default([]),
		fundingNeeds: z.array(mcpFilterValueSchema).max(12).default([]),
		founderIdentities: z.array(mcpFilterValueSchema).max(12).default([]),
		hiringStatus: mcpFilterValueSchema.optional(),
		keywords: z.string().trim().min(1).max(240).optional(),
		limit: mcpToolLimitSchema,
	})
	.strict();

export const mcpHiringStatusSchema = z.enum([
	"NOT_HIRING",
	"HIRING",
	"ACTIVELY_HIRING",
	"UNKNOWN",
]);

export const mcpSearchCompaniesInputSchema = z
	.object({
		q: z.string().trim().min(1).max(120).optional(),
		sector: mcpFilterValueSchema.optional(),
		stage: mcpFilterValueSchema.optional(),
		hiringStatus: mcpHiringStatusSchema.optional(),
		employeeMin: z.number().int().min(0).optional(),
		employeeMax: z.number().int().min(0).optional(),
		city: mcpFilterValueSchema.optional(),
		county: mcpFilterValueSchema.optional(),
		limit: mcpToolLimitSchema,
	})
	.strict();

export type GetProfileInput = z.infer<typeof emptyInputSchema>;
export type ProfileInfo = z.infer<typeof profileInfoSchema>;
export type SupportDocumentationTopic = z.infer<
	typeof supportDocumentationTopicSchema
>;
export type SupportDocumentationInput = z.infer<
	typeof supportDocumentationInputSchema
>;
export type McpSearchResourcesInput = z.infer<
	typeof mcpSearchResourcesInputSchema
>;
export type McpGetByIdOrSlugInput = z.infer<typeof mcpGetByIdOrSlugInputSchema>;
export type McpRecommendResourcesInput = z.infer<
	typeof mcpRecommendResourcesInputSchema
>;
export type McpSearchCompaniesInput = z.infer<
	typeof mcpSearchCompaniesInputSchema
>;
export type AgentReferenceKind = z.infer<typeof agentReferenceKindSchema>;
export type AgentReference = z.infer<typeof agentReferenceSchema>;
export type AgentReferenceBlock = z.infer<typeof agentReferenceBlockSchema>;
