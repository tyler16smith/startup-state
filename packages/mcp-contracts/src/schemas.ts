import { z } from "zod";

export const emptyInputSchema = z.object({}).strict();

export const agentReferenceKindSchema = z.enum([
	"resource",
	"company",
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
		href: z.string().min(1).max(500),
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

export type GetProfileInput = z.infer<typeof emptyInputSchema>;
export type ProfileInfo = z.infer<typeof profileInfoSchema>;
export type AgentReferenceKind = z.infer<typeof agentReferenceKindSchema>;
export type AgentReference = z.infer<typeof agentReferenceSchema>;
export type AgentReferenceBlock = z.infer<typeof agentReferenceBlockSchema>;
