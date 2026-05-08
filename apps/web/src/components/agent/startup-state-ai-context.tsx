"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { trackStartupStateAI } from "~/lib/agent-analytics";

const PANEL_QUERY_PARAM = "agent";
const PANEL_QUERY_OPEN_VALUE = "open";

type StartupStateAIPanelContextValue = {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
};

const StartupStateAIPanelContext =
	createContext<StartupStateAIPanelContextValue | null>(null);

export function StartupStateAIPanelProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		setIsOpen(searchParams.get(PANEL_QUERY_PARAM) === PANEL_QUERY_OPEN_VALUE);
	}, [searchParams]);

	const updatePanelQuery = useCallback(
		(nextOpen: boolean) => {
			const params = new URLSearchParams(searchParams.toString());
			if (nextOpen) {
				params.set(PANEL_QUERY_PARAM, PANEL_QUERY_OPEN_VALUE);
			} else {
				params.delete(PANEL_QUERY_PARAM);
			}

			const currentQuery = searchParams.toString();
			const nextQuery = params.toString();
			if (currentQuery === nextQuery) return;

			const hash = typeof window === "undefined" ? "" : window.location.hash;
			router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}${hash}`, {
				scroll: false,
			});
		},
		[pathname, router, searchParams],
	);

	const setPanelOpen = useCallback(
		(nextOpen: boolean) => {
			setIsOpen((current) => {
				if (current !== nextOpen) {
					trackStartupStateAI(
						nextOpen ? "agent_panel_opened" : "agent_panel_closed",
					);
				}
				return nextOpen;
			});
			updatePanelQuery(nextOpen);
		},
		[updatePanelQuery],
	);

	const open = useCallback(() => {
		setPanelOpen(true);
	}, [setPanelOpen]);

	const close = useCallback(() => {
		setPanelOpen(false);
	}, [setPanelOpen]);

	const toggle = useCallback(() => {
		setPanelOpen(!isOpen);
	}, [isOpen, setPanelOpen]);

	return (
		<StartupStateAIPanelContext.Provider
			value={{ isOpen, open, close, toggle }}
		>
			{children}
		</StartupStateAIPanelContext.Provider>
	);
}

export function useStartupStateAIPanel(): StartupStateAIPanelContextValue {
	const ctx = useContext(StartupStateAIPanelContext);
	if (!ctx) {
		throw new Error(
			"useStartupStateAIPanel must be used inside StartupStateAIPanelProvider",
		);
	}
	return ctx;
}
