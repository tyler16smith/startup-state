import { useEffect, useRef } from "react";
import { StartupStateAITimelineBlockRenderer } from "~/components/agent/startup-state-ai-timeline-block";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useStartupStateAIMessageListState } from "./chat-store";
import { suggestedPrompts } from "./utils";

export function MessageList() {
	const { blocks, selectSuggestedPrompt } = useStartupStateAIMessageListState();
	const bottomRef = useRef<HTMLDivElement | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll should fire on every new message/chunk
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: "end" });
	}, [blocks.length]);

	return (
		<ScrollArea className="min-h-0 flex-1">
			<div className="space-y-4 p-4">
				{blocks.length === 0 ? (
					<EmptyPromptList onSelectPrompt={selectSuggestedPrompt} />
				) : (
					blocks.map((block) => (
						<StartupStateAITimelineBlockRenderer block={block} key={block.id} />
					))
				)}
				<div ref={bottomRef} />
			</div>
		</ScrollArea>
	);
}

function EmptyPromptList({
	onSelectPrompt,
}: {
	onSelectPrompt: (prompt: string) => void;
}) {
	return (
		<div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
			<p className="max-w-56 font-medium text-muted-foreground text-xl">
				Let's chat
			</p>
			<div className="flex w-full max-w-72 flex-col gap-2">
				{suggestedPrompts.map((prompt) => (
					<button
						className="rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
						key={prompt}
						onClick={() => onSelectPrompt(prompt)}
						type="button"
					>
						{prompt}
					</button>
				))}
			</div>
		</div>
	);
}
