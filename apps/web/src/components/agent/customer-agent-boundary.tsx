"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StartupStateAIPanelProvider } from "~/components/agent/startup-state-ai-context";
import { StartupStateAIWorkspace } from "~/components/agent/startup-state-ai-workspace";

const CUSTOMER_ROUTE_PREFIXES = [
	"/explore",
	"/resources",
	"/map",
	"/companies",
];

function isCustomerRoute(pathname: string) {
	return CUSTOMER_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function CustomerAgentBoundary({ children }: { children: ReactNode }) {
	const pathname = usePathname();

	if (!isCustomerRoute(pathname)) return children;

	return (
		<StartupStateAIPanelProvider>
			<div className="flex h-screen bg-background">
				<StartupStateAIWorkspace>{children}</StartupStateAIWorkspace>
			</div>
		</StartupStateAIPanelProvider>
	);
}
