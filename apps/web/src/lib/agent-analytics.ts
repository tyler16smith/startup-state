"use client";

import { posthog } from "~/lib/posthog";

type StartupStateAIEvent =
	| "agent_panel_opened"
	| "agent_panel_closed"
	| "agent_message_sent"
	| "agent_run_completed"
	| "agent_run_aborted"
	| "agent_run_failed"
	| "agent_reference_clicked"
	| "agent_conversation_reset"
	| "agent_acknowledgement_accepted"
	| "agent_suggested_prompt_clicked";

export function trackStartupStateAI(
	event: StartupStateAIEvent,
	properties: Record<string, unknown> = {},
) {
	try {
		posthog.capture(event, properties);
	} catch {
		// posthog may not be initialized in dev — never throw from analytics
	}
}
