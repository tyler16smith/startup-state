import type { z } from "zod";

export type AgentToolCapability = "read:app";

export type ToolSafetyClass =
	| "read_only_app_data"
	| "mutates_app_data"
	| "external_network"
	| "sandboxed_code_execution"
	| "unsafe_disabled";

export type AgentToolExecutionContext = {
	userId: string;
	householdId?: string;
	conversationId: string;
	runId: string;
	stepId: string;
	abortSignal?: AbortSignal;
	emit?: (event: import("../events").FinStreamEvent) => void | Promise<void>;
};

export type FinToolCapability = AgentToolCapability;
export type FinToolExecutionContext = AgentToolExecutionContext;
export type ToolExecutionContext = AgentToolExecutionContext;

export type FinToolDefinition<TInput = unknown, TOutput = unknown> = {
	name: string;
	displayName: string;
	description: string;
	enabled: boolean;
	capabilities: AgentToolCapability[];
	safetyClass: ToolSafetyClass;
	inputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
	outputSchema?: z.ZodType<TOutput>;
	requiresConfirmation?: boolean;
	execute(input: TInput, context: AgentToolExecutionContext): Promise<TOutput>;
};

export type ToolExecutionResult =
	| {
			status: "success";
			data: unknown;
			summary?: string;
	  }
	| {
			status: "needs_user_input";
			questions: string[];
	  }
	| {
			status: "needs_confirmation";
			confirmationId: string;
			summary: string;
			preview: unknown;
	  }
	| {
			status: "error";
			message: string;
	  };
