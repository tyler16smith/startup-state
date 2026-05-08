"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { FinAiPanelProvider } from "~/components/agent/fin-ai-context";
import { FinAiWorkspace } from "~/components/agent/fin-ai-workspace";

const CUSTOMER_ROUTE_PREFIXES = [
	"/founder",
	"/resources",
	"/map",
	"/companies",
];

function isCustomerRoute(pathname: string) {
	return (
		pathname === "/" ||
		CUSTOMER_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
	);
}

export function CustomerAgentBoundary({ children }: { children: ReactNode }) {
	const pathname = usePathname();

	if (!isCustomerRoute(pathname)) return children;

	return (
		<FinAiPanelProvider>
			<div className="flex min-h-screen bg-background">
				<FinAiWorkspace>{children}</FinAiWorkspace>
			</div>
		</FinAiPanelProvider>
	);
}
