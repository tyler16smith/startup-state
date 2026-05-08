"use client";

import { Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useStartupStateAIPanel } from "~/components/agent/startup-state-ai-context";
import { StartupStateAIPanel } from "~/components/agent/startup-state-ai-panel";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

function useIsMobile() {
	const [isMobile, setIsMobile] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(max-width: 767px)");
		setIsMobile(mq.matches);
		const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);
	return isMobile;
}

export function StartupStateAIWorkspace({ children }: { children: ReactNode }) {
	const { isOpen, close, toggle } = useStartupStateAIPanel();
	const isMobile = useIsMobile();

	return (
		<div className="relative flex min-w-0 flex-1 overflow-hidden">
			<div className="relative flex min-w-0 flex-1 flex-col overflow-auto">
				{isOpen ? null : (
					<div className="pointer-events-none absolute top-3 right-3 z-30">
						<Button
							className="pointer-events-auto shadow-md shadow-white"
							onClick={toggle}
							size="sm"
						>
							<Sparkles className="size-4" />
							Agent
						</Button>
					</div>
				)}
				{children}
			</div>

			<aside
				aria-hidden={!isOpen}
				className={cn(
					"hidden min-h-0 shrink-0 overflow-hidden border-l bg-background transition-[width] duration-300 ease-out md:flex",
					isOpen ? "w-96" : "w-0 border-l-0",
				)}
			>
				<div className="h-full w-96 shrink-0">
					<StartupStateAIPanel onClose={close} />
				</div>
			</aside>

			<Sheet
				onOpenChange={(next) => !next && close()}
				open={isOpen && isMobile}
			>
				<SheetContent
					className="flex h-full w-full max-w-md flex-col gap-0 p-0"
					showCloseButton={false}
					side="right"
				>
					<StartupStateAIPanel onClose={close} />
				</SheetContent>
			</Sheet>
		</div>
	);
}
