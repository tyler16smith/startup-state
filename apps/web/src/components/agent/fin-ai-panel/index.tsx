"use client";

import { useFeatureFlagEnabled } from "posthog-js/react";
import { useEffect } from "react";
import { ChatComposer } from "./chat-composer";
import { ChatHeader } from "./chat-header";
import { useFinAiChatActions } from "./chat-store";
import { FinAiComingSoonOverlay } from "./coming-soon-overlay";
import { MessageList } from "./message-list";

export function FinAiPanel({ onClose }: { onClose: () => void }) {
	const hasFinAiFlag = useFeatureFlagEnabled("fin-ai-agent");
	const { abortActiveRun, loadStoredTimeline, refreshConversationList } =
		useFinAiChatActions();

	useEffect(() => {
		void loadStoredTimeline();
		void refreshConversationList();
		return () => abortActiveRun();
	}, [abortActiveRun, loadStoredTimeline, refreshConversationList]);

	return (
		<section className="relative flex h-full min-h-0 w-full flex-col bg-background">
			{!hasFinAiFlag && <FinAiComingSoonOverlay />}
			<ChatHeader onClose={onClose} />
			<div
				className={
					hasFinAiFlag
						? "flex min-h-0 flex-1 flex-col"
						: "pointer-events-none flex min-h-0 flex-1 flex-col blur-sm"
				}
			>
				<MessageList />
				<ChatComposer />
			</div>
		</section>
	);
}
