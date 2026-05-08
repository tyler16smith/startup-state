import { clearCsrfToken, getCsrfToken } from "@app/client-ts";
import {
	type MessageReference,
	normalizeMessageReferences,
} from "@app/mcp-contracts";
import type { StartupStateAITimelineBlock } from "~/components/agent/startup-state-ai-timeline-block";
import type {
	StartupStateWidget,
	StartupStateWidgetActionType,
} from "~/components/agent/startup-state-ai-widgets";
import { toApiUrl } from "~/lib/api-url";

export type StartupStateAgentStreamEvent =
	| {
			type: "run_started";
			conversationId: string;
			runId: string;
			title?: string;
	  }
	| {
			type: "status";
			content: string;
	  }
	| {
			type: "message_delta";
			content: string;
			runId?: string;
			stepId?: string;
	  }
	| {
			type: "message_done";
			messageId: string;
			runId?: string;
			stepId?: string;
	  }
	| {
			type: "tool_call_started";
			runId: string;
			stepId: string;
			toolCallId: string;
			toolName: string;
			displayName?: string;
	  }
	| {
			type: "tool_call_done";
			runId: string;
			stepId: string;
			toolCallId: string;
			toolName: string;
			summary: string;
	  }
	| {
			type: "references_done";
			runId: string;
			stepId: string;
			referenceBlockId: string;
			toolCallId?: string;
			toolName?: string;
			title?: string;
			references: MessageReference[];
	  }
	| {
			type: "run_step_started";
			runId: string;
			stepId: string;
			stepIndex: number;
			stepType: "model_response" | "tool_execution" | "user_input_required";
	  }
	| {
			type: "run_step_done";
			runId: string;
			stepId: string;
			stepIndex: number;
			stepType: "model_response" | "tool_execution" | "user_input_required";
	  }
	| {
			type: "widget_started";
			runId: string;
			stepId: string;
			widgetId: string;
			widgetType: string;
	  }
	| {
			type: "widget_done";
			runId: string;
			stepId: string;
			widget: StartupStateWidget;
	  }
	| {
			type: "action_done";
			runId: string;
			stepId: string;
			actionId: string;
			actionType: StartupStateWidgetActionType;
			summary: string;
			result?: unknown;
	  }
	| {
			type: "user_input_required";
			runId: string;
			stepId: string;
			reason:
				| "confirmation_required"
				| "missing_required_field"
				| "clarification_required";
			payload?: unknown;
	  }
	| {
			type: "run_cancelled";
			runId: string;
	  }
	| {
			type: "error";
			runId?: string;
			stepId?: string;
			error: {
				code?: string;
				message: string;
			};
	  };

export type StartupStateAgentStreamInput = {
	conversationId?: string;
	message: string;
	clientRequestId: string;
	clientContext?: {
		currentRoute?: string;
		activePage?: string;
	};
};

export type StartupStateWidgetActionStreamInput = {
	conversationId: string;
	widgetId: string;
	actionType: StartupStateWidgetActionType;
	values: Record<string, unknown>;
	clientRequestId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(
	record: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = record[key];
	return typeof value === "string" ? value : undefined;
}

function numberValue(
	record: Record<string, unknown>,
	key: string,
): number | undefined {
	const value = record[key];
	return typeof value === "number" ? value : undefined;
}

function recordValue(
	record: Record<string, unknown>,
	key: string,
): Record<string, unknown> | undefined {
	const value = record[key];
	return isRecord(value) ? value : undefined;
}

function arrayValue(record: Record<string, unknown>, key: string): unknown[] {
	const value = record[key];
	return Array.isArray(value) ? value : [];
}

function errorValue(record: Record<string, unknown>) {
	const error = recordValue(record, "error");
	if (!error) return undefined;
	const message = stringValue(error, "message");
	if (!message) return undefined;
	return { message, code: stringValue(error, "code") };
}

function stepTypeValue(
	value: unknown,
): "model_response" | "tool_execution" | "user_input_required" | undefined {
	if (
		value === "model_response" ||
		value === "tool_execution" ||
		value === "user_input_required"
	) {
		return value;
	}
	return undefined;
}

function parseStartupStateAgentEvent(
	rawData: string,
): StartupStateAgentStreamEvent | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(rawData);
	} catch {
		return null;
	}

	if (!isRecord(parsed)) return null;
	const type = stringValue(parsed, "type");

	switch (type) {
		case "run_started": {
			const conversationId = stringValue(parsed, "conversationId");
			const runId = stringValue(parsed, "runId");
			if (!conversationId || !runId) return null;
			return {
				type,
				conversationId,
				runId,
				title: stringValue(parsed, "title"),
			};
		}
		case "status": {
			const content = stringValue(parsed, "content");
			if (content === undefined) return null;
			return { type, content };
		}
		case "message_delta": {
			const content = stringValue(parsed, "content");
			if (content === undefined) return null;
			return {
				type,
				content,
				runId: stringValue(parsed, "runId"),
				stepId: stringValue(parsed, "stepId"),
			};
		}
		case "message_done": {
			const messageId = stringValue(parsed, "messageId");
			if (!messageId) return null;
			return {
				type,
				messageId,
				runId: stringValue(parsed, "runId"),
				stepId: stringValue(parsed, "stepId"),
			};
		}
		case "tool_call_started": {
			const runId = stringValue(parsed, "runId");
			const stepId = stringValue(parsed, "stepId");
			const toolCallId = stringValue(parsed, "toolCallId");
			const toolName = stringValue(parsed, "toolName");
			const displayName = stringValue(parsed, "displayName");
			if (!runId || !stepId || !toolCallId || !toolName) return null;
			return { type, runId, stepId, toolCallId, toolName, displayName };
		}
		case "tool_call_done": {
			const runId = stringValue(parsed, "runId");
			const stepId = stringValue(parsed, "stepId");
			const toolCallId = stringValue(parsed, "toolCallId");
			const toolName = stringValue(parsed, "toolName");
			const summary = stringValue(parsed, "summary");
			if (!runId || !stepId || !toolCallId || !toolName || !summary)
				return null;
			return { type, runId, stepId, toolCallId, toolName, summary };
		}
		case "references_done": {
			const runId = stringValue(parsed, "runId");
			const stepId = stringValue(parsed, "stepId");
			const referenceBlockId = stringValue(parsed, "referenceBlockId");
			const toolName = stringValue(parsed, "toolName");
			if (!runId || !stepId || !referenceBlockId) return null;
			return {
				type,
				runId,
				stepId,
				referenceBlockId,
				toolCallId: stringValue(parsed, "toolCallId"),
				toolName,
				title: stringValue(parsed, "title"),
				references: normalizeMessageReferences(
					arrayValue(parsed, "references"),
					{
						toolName,
					},
				),
			};
		}
		case "run_step_started":
		case "run_step_done": {
			const runId = stringValue(parsed, "runId");
			const stepId = stringValue(parsed, "stepId");
			const stepIndex = numberValue(parsed, "stepIndex");
			const stepType = stepTypeValue(parsed.stepType);
			if (!runId || !stepId || stepIndex === undefined || !stepType)
				return null;
			return {
				type,
				runId,
				stepId,
				stepIndex,
				stepType,
			};
		}
		case "widget_started": {
			const runId = stringValue(parsed, "runId");
			const stepId = stringValue(parsed, "stepId");
			const widgetId = stringValue(parsed, "widgetId");
			const widgetType = stringValue(parsed, "widgetType");
			if (!runId || !stepId || !widgetId || !widgetType) return null;
			return { type, runId, stepId, widgetId, widgetType };
		}
		case "widget_done": {
			const runId = stringValue(parsed, "runId");
			const stepId = stringValue(parsed, "stepId");
			const widget = recordValue(parsed, "widget");
			if (!runId || !stepId || !widget) return null;
			return { type, runId, stepId, widget: widget as StartupStateWidget };
		}
		case "action_done": {
			const runId = stringValue(parsed, "runId");
			const stepId = stringValue(parsed, "stepId");
			const actionId = stringValue(parsed, "actionId");
			const actionType = stringValue(parsed, "actionType") as
				| StartupStateWidgetActionType
				| undefined;
			const summary = stringValue(parsed, "summary");
			if (!runId || !stepId || !actionId || !actionType || !summary)
				return null;
			return {
				type,
				runId,
				stepId,
				actionId,
				actionType,
				summary,
				result: parsed.result,
			};
		}
		case "user_input_required": {
			const runId = stringValue(parsed, "runId");
			const stepId = stringValue(parsed, "stepId");
			const reason = stringValue(parsed, "reason");
			if (
				!runId ||
				!stepId ||
				(reason !== "confirmation_required" &&
					reason !== "missing_required_field" &&
					reason !== "clarification_required")
			) {
				return null;
			}
			return { type, runId, stepId, reason, payload: parsed.payload };
		}
		case "run_cancelled": {
			const runId = stringValue(parsed, "runId");
			if (!runId) return null;
			return { type, runId };
		}
		case "error": {
			const error = errorValue(parsed);
			if (!error) return null;
			return {
				type,
				error,
				runId: stringValue(parsed, "runId"),
				stepId: stringValue(parsed, "stepId"),
			};
		}
		default:
			return null;
	}
}

async function postJson<TInput, TOutput>(
	path: string,
	input: TInput,
): Promise<TOutput> {
	const csrfToken = await getCsrfToken();
	const response = await fetch(toApiUrl(path), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify(input),
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	const payload: unknown = await response.json();
	if (!isRecord(payload) || !isRecord(payload.data)) {
		throw new Error("Unexpected API response.");
	}
	return payload.data as TOutput;
}

function getSseData(block: string): string | null {
	const dataLines = block
		.split("\n")
		.filter((line) => line.startsWith("data:"))
		.map((line) => line.slice(5).trimStart());

	return dataLines.length > 0 ? dataLines.join("\n") : null;
}

async function readErrorMessage(response: Response): Promise<string> {
	try {
		const payload: unknown = await response.json();
		if (!isRecord(payload)) return "Unable to start Agent.";
		const error = payload.error;
		if (!isRecord(error)) return "Unable to start Agent.";
		return stringValue(error, "message") ?? "Unable to start Agent.";
	} catch {
		return "Unable to start Agent.";
	}
}

export async function streamStartupStateAgentMessage({
	input,
	onEvent,
	signal,
}: {
	input: StartupStateAgentStreamInput;
	onEvent: (event: StartupStateAgentStreamEvent) => void;
	signal?: AbortSignal;
}): Promise<void> {
	// Always fetch a fresh CSRF token. The server now derives it from userId
	// (sub) which is stable, but the client cache may hold an old iat-based
	// token from a previous server version.
	clearCsrfToken();
	const csrfToken = await getCsrfToken();
	const response = await fetch(toApiUrl("/api/v1/agent/chat/stream"), {
		method: "POST",
		credentials: "include",
		signal,
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify(input),
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	if (!response.body) {
		throw new Error("Agent did not return a response stream.");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	const processBlock = (block: string) => {
		const data = getSseData(block.trim());
		if (!data) return;
		const event = parseStartupStateAgentEvent(data);
		if (event) onEvent(event);
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		let boundary = buffer.indexOf("\n\n");

		while (boundary !== -1) {
			processBlock(buffer.slice(0, boundary));
			buffer = buffer.slice(boundary + 2);
			boundary = buffer.indexOf("\n\n");
		}
	}

	buffer += decoder.decode();
	if (buffer.trim()) processBlock(buffer);
}

export async function streamStartupStateWidgetAction({
	input,
	onEvent,
	signal,
}: {
	input: StartupStateWidgetActionStreamInput;
	onEvent: (event: StartupStateAgentStreamEvent) => void;
	signal?: AbortSignal;
}): Promise<void> {
	const csrfToken = await getCsrfToken();
	const response = await fetch(toApiUrl("/api/v1/agent/widget-action/stream"), {
		method: "POST",
		credentials: "include",
		signal,
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify(input),
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	if (!response.body) {
		throw new Error("Agent did not return an action stream.");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	const processBlock = (block: string) => {
		const data = getSseData(block.trim());
		if (!data) return;
		const event = parseStartupStateAgentEvent(data);
		if (event) onEvent(event);
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		let boundary = buffer.indexOf("\n\n");

		while (boundary !== -1) {
			processBlock(buffer.slice(0, boundary));
			buffer = buffer.slice(boundary + 2);
			boundary = buffer.indexOf("\n\n");
		}
	}

	buffer += decoder.decode();
	if (buffer.trim()) processBlock(buffer);
}

export async function fetchStartupStateAgentTimeline(input: {
	conversationId: string;
}): Promise<StartupStateAITimelineBlock[]> {
	const result = await postJson<
		{ conversationId: string; limit: number },
		{ blocks: StartupStateAITimelineBlock[] }
	>("/api/v1/agent/listTimeline", {
		conversationId: input.conversationId,
		limit: 200,
	});
	return result.blocks;
}

export type ConversationSummary = {
	id: string;
	title: string | null;
	createdAt: string;
	updatedAt: string;
};

export async function fetchConversationList(input?: {
	limit?: number;
}): Promise<ConversationSummary[]> {
	const result = await postJson<
		{ limit?: number },
		{ conversations: ConversationSummary[] }
	>("/api/v1/agent/listConversations", { limit: input?.limit ?? 20 });
	return result.conversations;
}

export async function nameConversationFromFirstMessage(input: {
	conversationId: string;
	firstMessage: string;
}): Promise<ConversationSummary> {
	const result = await postJson<
		{ conversationId: string; firstMessage: string },
		{ conversation: ConversationSummary }
	>("/api/v1/agent/nameConversation", input);
	return result.conversation;
}

export async function renameConversation(input: {
	conversationId: string;
	title: string;
}): Promise<ConversationSummary> {
	const result = await postJson<
		{ conversationId: string; title: string },
		{ conversation: ConversationSummary }
	>("/api/v1/agent/renameConversation", input);
	return result.conversation;
}
