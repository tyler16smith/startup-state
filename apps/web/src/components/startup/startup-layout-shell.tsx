"use client";

import { usePathname } from "next/navigation";
import { StartupSidebar } from "~/components/startup/startup-sidebar";

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
	const fullPage = fullPageRoutes.has(pathname);

	if (fullPage) {
		return (
			<div className="min-h-screen bg-white text-slate-950">{children}</div>
		);
	}

	return (
		<div className="flex h-screen bg-gray-50 text-slate-950">
			<StartupSidebar />
			<div className="flex flex-1 flex-col overflow-auto">{children}</div>
		</div>
	);
}
