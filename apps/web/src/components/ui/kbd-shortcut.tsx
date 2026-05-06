"use client";

import { useMemo } from "react";

function isMacOS(): boolean {
	if (typeof window === "undefined") return true;
	return navigator.platform.toUpperCase().includes("MAC");
}

const KEY_DISPLAY: Record<string, { mac: string; other: string } | string> = {
	Mod: { mac: "⌘", other: "Ctrl" },
	Shift: "⇧",
	Alt: { mac: "⌥", other: "Alt" },
	ArrowLeft: "←",
	ArrowRight: "→",
	ArrowUp: "↑",
	ArrowDown: "↓",
	Backspace: "⌫",
	Enter: "↵",
};

function getKeyLabel(key: string, isMac: boolean): string {
	const display = KEY_DISPLAY[key];
	if (!display) return key;
	if (typeof display === "string") return display;
	return isMac ? display.mac : display.other;
}

const KeyClassName: Record<string, string> = {
	Enter: "-mt-0.5",
};

export function KbdShortcut({
	keys = ["Mod", "Enter"],
	className,
}: {
	keys?: string[];
	className?: string;
}) {
	const isMac = useMemo(() => isMacOS(), []);

	return (
		<span
			className={`ml-0.5 inline-flex gap-0.5 text-sm text-white ${className ?? ""}`.trim()}
		>
			{keys.map((key, i) => (
				<kbd
					className={`inline-block rounded bg-gray-700 px-1 py-0.5 leading-none ${KeyClassName[key] ?? ""}`}
					// biome-ignore lint/suspicious/noArrayIndexKey: static key list
					key={i}
				>
					{getKeyLabel(key, isMac)}
				</kbd>
			))}
		</span>
	);
}
