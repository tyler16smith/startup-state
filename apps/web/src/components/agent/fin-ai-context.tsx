"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { trackFinAi } from "~/lib/agent-analytics";

type FinAiPanelContextValue = {
	isOpen: boolean;
	open: () => void;
	close: () => void;
	toggle: () => void;
};

const FinAiPanelContext = createContext<FinAiPanelContextValue | null>(null);

export function FinAiPanelProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [isOpen, setIsOpen] = useState(false);

	const open = useCallback(() => {
		setIsOpen((current) => {
			if (!current) trackFinAi("agent_panel_opened");
			return true;
		});
	}, []);

	const close = useCallback(() => {
		setIsOpen((current) => {
			if (current) trackFinAi("agent_panel_closed");
			return false;
		});
	}, []);

	const toggle = useCallback(() => {
		setIsOpen((current) => {
			trackFinAi(current ? "agent_panel_closed" : "agent_panel_opened");
			return !current;
		});
	}, []);

	return (
		<FinAiPanelContext.Provider value={{ isOpen, open, close, toggle }}>
			{children}
		</FinAiPanelContext.Provider>
	);
}

export function useFinAiPanel(): FinAiPanelContextValue {
	const ctx = useContext(FinAiPanelContext);
	if (!ctx) {
		throw new Error("useFinAiPanel must be used inside FinAiPanelProvider");
	}
	return ctx;
}
