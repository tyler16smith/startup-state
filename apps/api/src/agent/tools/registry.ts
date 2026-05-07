import { zodToJsonSchema } from "zod-to-json-schema";
import type { AgentToolSpec } from "../providers/model-provider";
import { placeholderTools } from "./placeholders";
import { startupNavigatorTools } from "./startup-navigator";
import type { FinToolDefinition } from "./types";

export const finTools: Record<string, FinToolDefinition> = {
	...placeholderTools,
	...startupNavigatorTools,
};

export function getEnabledToolDefinitions(): FinToolDefinition[] {
	return Object.values(finTools).filter(
		(tool) => tool.enabled && tool.safetyClass !== "unsafe_disabled",
	);
}

export function getEnabledToolSpecs(): AgentToolSpec[] {
	return getEnabledToolDefinitions().map((tool) => ({
		name: tool.name,
		description: tool.description,
		parameters: zodToJsonSchema(tool.inputSchema, {
			$refStrategy: "none",
		}) as Record<string, unknown>,
	}));
}

export function getToolDefinition(name: string): FinToolDefinition | undefined {
	const tool = finTools[name];
	if (!tool?.enabled) return undefined;
	return tool;
}
