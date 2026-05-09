"use client";

import { Menu, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
	StartupStateAIPanelProvider,
	useStartupStateAIPanel,
} from "~/components/agent/startup-state-ai-context";
import { StartupStateAIWorkspace } from "~/components/agent/startup-state-ai-workspace";
import { StartupSidebar } from "~/components/startup/startup-sidebar";
import { Button } from "~/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "~/components/ui/sheet";

const fullPageRoutes = new Set(["/", "/founder", "/investor"]);

export function StartupLayoutShell({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const [open, setOpen] = useState(false);
	const fullPage = fullPageRoutes.has(pathname);

	if (fullPage) {
		return (
			<div className="min-h-screen bg-white text-slate-950">{children}</div>
		);
	}

	return (
		<Suspense>
			<StartupStateAIPanelProvider>
				<div className="flex h-screen flex-col bg-gray-50 text-slate-950 md:flex-row">
					<a
						className="sr-only z-[100] rounded-md bg-white px-3 py-2 font-medium text-slate-950 shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
						href="#startup-main-content"
					>
						Skip to content
					</a>
					<div className="flex h-12 shrink-0 items-center gap-3 border-slate-200 border-b bg-gray-50 px-4 md:hidden">
						<MobileNavigationSheet onOpenChange={setOpen} open={open} />
						<span className="min-w-0 truncate font-semibold text-sm">
							Startup State
						</span>
						{pathname !== "/map" && <MobileAgentButton />}
					</div>
					<StartupSidebar className="hidden md:flex" />
					<StartupStateAIWorkspace>
						<div
							className="h-full min-h-full"
							id="startup-main-content"
							tabIndex={-1}
						>
							{children}
						</div>
					</StartupStateAIWorkspace>
				</div>
			</StartupStateAIPanelProvider>
		</Suspense>
	);
}

function MobileAgentButton() {
	const { isOpen, toggle } = useStartupStateAIPanel();

	return (
		<Button
			aria-label={isOpen ? "Close Agent" : "Open Agent"}
			aria-pressed={isOpen}
			className="ml-auto shrink-0"
			onClick={toggle}
			size="sm"
			type="button"
			variant={isOpen ? "default" : "outline"}
		>
			<Sparkles className="size-4" />
			Agent
		</Button>
	);
}

function MobileNavigationSheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<div className="flex size-9 shrink-0 items-center justify-center">
			{mounted ? (
				<Sheet onOpenChange={onOpenChange} open={open}>
					<SheetTrigger asChild>
						<Button aria-label="Open navigation" size="icon" variant="ghost">
							<Menu className="h-5 w-5" />
						</Button>
					</SheetTrigger>
					<SheetContent className="w-64 p-0" side="left">
						<SheetHeader className="sr-only">
							<SheetTitle>Navigation</SheetTitle>
							<SheetDescription>
								Primary navigation for Startup State.
							</SheetDescription>
						</SheetHeader>
						<StartupSidebar onClose={() => onOpenChange(false)} />
					</SheetContent>
				</Sheet>
			) : null}
		</div>
	);
}
