import type { AgentReference } from "@app/mcp-contracts";
import type { FinWidgetActionType } from "./widgets/actions";
import type { FinWidget, FinWidgetType } from "./widgets/types";

export type FinStreamEvent =
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
			references: AgentReference[];
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
			widgetType: FinWidgetType;
	  }
	| {
			type: "widget_done";
			runId: string;
			stepId: string;
			widget: FinWidget;
	  }
	| {
			type: "action_started";
			runId: string;
			stepId: string;
			actionId: string;
			actionType: FinWidgetActionType;
			label?: string;
	  }
	| {
			type: "action_done";
			runId: string;
			stepId: string;
			actionId: string;
			actionType: FinWidgetActionType;
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
