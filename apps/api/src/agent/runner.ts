import type { AgentClientContext } from "./context-builder";
import type { FinStreamEvent } from "./events";

export type FinAgentRunInput = {
	userId: string;
	householdId?: string;
	conversationId?: string;
	message: string;
	clientRequestId?: string;
	clientContext?: AgentClientContext;
	signal?: AbortSignal;
};

export interface FinAgentRunner {
	run(input: FinAgentRunInput): AsyncIterable<FinStreamEvent>;
}
