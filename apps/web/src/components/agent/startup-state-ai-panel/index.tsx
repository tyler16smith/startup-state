"use client";

import { useEffect } from "react";
import { ChatComposer } from "./chat-composer";
import { ChatHeader } from "./chat-header";
import { useStartupStateAIChatActions } from "./chat-store";
import { MessageList } from "./message-list";

export function StartupStateAIPanel({ onClose }: { onClose: () => void }) {
	const { abortActiveRun, loadStoredTimeline, refreshConversationList } =
		useStartupStateAIChatActions();

	useEffect(() => {
		void loadStoredTimeline();
		void refreshConversationList();
		return () => abortActiveRun();
	}, [abortActiveRun, loadStoredTimeline, refreshConversationList]);

	return (
		<section className="relative flex h-full min-h-0 w-full flex-col bg-background">
			<ChatHeader onClose={onClose} />
			<div className="flex min-h-0 flex-1 flex-col">
				<MessageList />
				<ChatComposer />
			</div>
		</section>
	);
}
