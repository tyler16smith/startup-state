"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { StartupSidebar } from "~/components/startup/startup-sidebar";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";

const fullPageRoutes = new Set([
	"/",
	"/founder",
	"/founder/results",
	"/investor",
	"/investor/results",
]);

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
		<div className="flex h-screen flex-col bg-gray-50 text-slate-950 md:flex-row">
			<div className="flex h-12 shrink-0 items-center gap-3 border-slate-200 border-b bg-gray-50 px-4 md:hidden">
				<Sheet onOpenChange={setOpen} open={open}>
					<SheetTrigger asChild>
						<Button aria-label="Open navigation" size="icon" variant="ghost">
							<Menu className="h-5 w-5" />
						</Button>
					</SheetTrigger>
					<SheetContent className="w-64 p-0" side="left">
						<StartupSidebar onClose={() => setOpen(false)} />
					</SheetContent>
				</Sheet>
				<span className="font-semibold text-sm">Startup State Navigator</span>
			</div>
			<StartupSidebar className="hidden md:flex" />
			<div className="flex min-h-0 flex-1 flex-col overflow-auto">
				{children}
			</div>
		</div>
	);
}
