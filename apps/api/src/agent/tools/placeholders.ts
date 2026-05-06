import { z } from "zod";
import type { FinToolDefinition } from "./types";

const helloWorldInputSchema = z.object({
	name: z.string().min(1).max(80).optional(),
});

type HelloWorldInput = z.infer<typeof helloWorldInputSchema>;

export const helloWorldTool: FinToolDefinition<HelloWorldInput> = {
	name: "hello_world",
	displayName: "Hello world",
	description: "Return a basic hello_world response for skeleton app wiring.",
	enabled: true,
	capabilities: ["read:app"],
	safetyClass: "read_only_app_data",
	inputSchema: helloWorldInputSchema,
	execute: async (input, context) => ({
		message: "hello_world",
		name: input.name ?? null,
		userId: context.userId,
		conversationId: context.conversationId,
		receivedAt: new Date().toISOString(),
	}),
};

export const placeholderTools: Record<string, FinToolDefinition> = {
	hello_world: helloWorldTool,
};
