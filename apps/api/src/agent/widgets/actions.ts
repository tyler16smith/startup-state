import { z } from "zod";

export type FinWidgetActionType = "noop";

export type FinWidgetActionContext = {
	userId: string;
	householdId?: string;
	conversationId: string;
	widgetId: string;
	runId: string;
	stepId: string;
	abortSignal?: AbortSignal;
};

export type FinWidgetActionDefinition<TInput = unknown, TOutput = unknown> = {
	type: FinWidgetActionType;
	description: string;
	inputSchema: z.ZodType<TInput>;
	execute: (input: TInput, context: FinWidgetActionContext) => Promise<TOutput>;
};

export const noopWidgetActionSchema = z.object({});

export const finWidgetActionRegistry = {
	noop: {
		type: "noop",
		description: "Placeholder widget action for skeleton wiring.",
		inputSchema: noopWidgetActionSchema,
		execute: async () => ({ message: "hello_world" }),
	},
} satisfies Record<FinWidgetActionType, FinWidgetActionDefinition>;
