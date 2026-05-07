"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { FinAiPanelProvider } from "~/components/agent/fin-ai-context";
import { FinAiWorkspace } from "~/components/agent/fin-ai-workspace";
import { DemoModeProvider } from "~/context/demo-mode-context";

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
		<DemoModeProvider>
			<FinAiPanelProvider>
				<div className="flex min-h-screen bg-background">
					<FinAiWorkspace>{children}</FinAiWorkspace>
				</div>
			</FinAiPanelProvider>
		</DemoModeProvider>
	);
}
