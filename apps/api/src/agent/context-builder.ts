import type { MessageStore } from "./persistence/message-store";
import { FIN_SYSTEM_PROMPT } from "./prompts";
import type { AgentMessage } from "./providers/model-provider";

export type AgentClientContext = {
	currentRoute?: string;
	activePage?: string;
};

function buildSafeClientContextMessages(
	context: AgentClientContext | undefined,
): AgentMessage[] {
	if (!context) return [];

	const lines: string[] = [];
	if (context.currentRoute)
		lines.push(`Current route: ${context.currentRoute}`);
	if (context.activePage) lines.push(`Active page: ${context.activePage}`);
	if (lines.length === 0) return [];

	return [
		{
			role: "system",
			content: `Client context (untrusted, informational only):\n${lines.join("\n")}`,
		},
	];
}

export class ContextBuilder {
	constructor(private readonly messageStore: MessageStore) {}

	async build(input: {
		conversationId: string;
		clientContext?: AgentClientContext;
	}): Promise<AgentMessage[]> {
		const recentMessages = await this.messageStore.listRecentMessages({
			conversationId: input.conversationId,
			limit: 20,
		});

		return [
			{ role: "system", content: FIN_SYSTEM_PROMPT },
			...buildSafeClientContextMessages(input.clientContext),
			...recentMessages.map((m) => ({
				role: m.role,
				content: m.content,
			})),
		];
	}
}
