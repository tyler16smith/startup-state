import { z } from "zod";

export const finWidgetSchema = z.object({
	id: z.string().min(1),
	type: z.literal("insight_card"),
	widgetSchemaVersion: z.string().default("1"),
	title: z.string().min(1),
	description: z.string().optional(),
	source: z.enum(["app", "example"]).default("app"),
	generatedAt: z.string(),
	interactionLevel: z
		.enum(["display_only", "server_action"])
		.default("display_only"),
	summary: z.string().min(1),
	items: z
		.array(
			z.object({
				label: z.string(),
				value: z.string(),
				tone: z.enum(["default", "positive", "negative", "warning"]).optional(),
			}),
		)
		.max(20)
		.optional(),
	actions: z
		.array(
			z.object({
				id: z.string(),
				label: z.string(),
				type: z.literal("noop"),
				style: z.enum(["primary", "secondary"]).optional(),
			}),
		)
		.max(5)
		.optional(),
});

export type FinWidgetInput = z.input<typeof finWidgetSchema>;
