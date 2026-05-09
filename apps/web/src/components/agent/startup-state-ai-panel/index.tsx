"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { cn } from "~/lib/utils";
import { ChatComposer } from "./chat-composer";
import { ChatHeader } from "./chat-header";
import { useStartupStateAIChatActions } from "./chat-store";
import { LoginOverlay } from "./login-overlay";
import { MessageList } from "./message-list";

export function StartupStateAIPanel({ onClose }: { onClose: () => void }) {
	const { status } = useSession();
	const { abortActiveRun, loadStoredTimeline, refreshConversationList } =
		useStartupStateAIChatActions();
	const isUnauthenticated = status === "unauthenticated";

	useEffect(() => {
		if (status !== "authenticated") {
			if (status === "unauthenticated") abortActiveRun();
			return;
		}

		void loadStoredTimeline();
		void refreshConversationList();
		return () => abortActiveRun();
	}, [abortActiveRun, loadStoredTimeline, refreshConversationList, status]);

	return (
		<section className="relative flex h-full min-h-0 w-full flex-col bg-background">
			<ChatHeader onClose={onClose} />
			<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
				<div
					className={cn(
						"flex min-h-0 flex-1 flex-col",
						isUnauthenticated && "pointer-events-none select-none blur-sm",
					)}
				>
					<MessageList />
					<ChatComposer />
				</div>
				{isUnauthenticated && <LoginOverlay />}
			</div>
		</section>
	);
}
