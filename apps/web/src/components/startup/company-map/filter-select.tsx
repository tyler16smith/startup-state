"use client";

import { ChevronDown, X } from "lucide-react";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { getFilterSuggestions } from "~/components/startup/company-map/filter-search";
import type { FilterOption } from "~/components/startup/company-map/types";

type FilterSelectProps = {
	label: string;
	onChange: (value: string) => void;
	options: FilterOption[];
	value: string;
};

export function FilterSelect({
	label,
	onChange,
	options,
	value,
}: FilterSelectProps) {
	const [open, setOpen] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const [popoverPosition, setPopoverPosition] = useState<{
		left: number;
		top: number;
	} | null>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const selectedLabel =
		options.find((option) => option.value === value)?.label ?? label;
	const popoverId = `${label.toLowerCase().replace(/\s+/g, "-")}-filter-options`;

	const suggestions = useMemo(
		() => getFilterSuggestions({ inputValue, label, options, value }),
		[inputValue, label, options, value],
	);

	const updatePopoverPosition = useCallback(() => {
		const trigger = triggerRef.current;
		if (!trigger) return;

		const rect = trigger.getBoundingClientRect();
		setPopoverPosition({
			left: Math.min(rect.left, window.innerWidth - 236),
			top: rect.bottom + 8,
		});
	}, []);

	useEffect(() => {
		if (!open) return;
		setActiveIndex(0);
		setInputValue("");
		updatePopoverPosition();
		window.setTimeout(() => inputRef.current?.focus(), 0);

		window.addEventListener("resize", updatePopoverPosition);
		window.addEventListener("scroll", updatePopoverPosition, true);
		return () => {
			window.removeEventListener("resize", updatePopoverPosition);
			window.removeEventListener("scroll", updatePopoverPosition, true);
		};
	}, [open, updatePopoverPosition]);

	function commit(nextValue: string) {
		onChange(nextValue);
		setInputValue("");
		setActiveIndex(0);
		setOpen(false);
	}

	function closeWithoutSaving() {
		setInputValue("");
		setActiveIndex(0);
		setOpen(false);
	}

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		const maxIndex = suggestions.length - 1;
		if (event.key === "ArrowDown") {
			event.preventDefault();
			if (maxIndex >= 0)
				setActiveIndex((index) => Math.min(index + 1, maxIndex));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((index) => Math.max(index - 1, 0));
		} else if (event.key === "Enter") {
			event.preventDefault();
			const chosen = suggestions[activeIndex];
			if (chosen) commit(chosen.value);
		} else if (event.key === "Escape") {
			event.preventDefault();
			closeWithoutSaving();
		}
	}

	function handleBlur() {
		window.setTimeout(() => {
			const trimmed = inputValue.trim().toLowerCase();
			const exactMatch = options.find(
				(option) => option.label.toLowerCase() === trimmed,
			);
			if (exactMatch) commit(exactMatch.value);
			else closeWithoutSaving();
		}, 120);
	}

	const popover = open && popoverPosition && (
		<div
			className="fixed z-[80] w-56 overflow-hidden rounded-lg border border-white/70 bg-white/90 shadow-xl backdrop-blur-md"
			id={popoverId}
			style={{ left: popoverPosition.left, top: popoverPosition.top }}
		>
			<div className="p-2">
				<input
					aria-label={`Search ${label} filter options`}
					className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
					onBlur={handleBlur}
					onChange={(event) => {
						setInputValue(event.target.value);
						setActiveIndex(0);
					}}
					onKeyDown={handleKeyDown}
					placeholder={`Search ${label.toLowerCase()}`}
					ref={inputRef}
					value={inputValue}
				/>
			</div>
			<ul className="py-1">
				{suggestions.map((option, index) => (
					<li key={option.value || `all-${label}`}>
						<button
							className={[
								"w-full px-3 py-1.5 text-left text-sm transition-colors",
								index === activeIndex
									? "bg-accent text-accent-foreground"
									: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
							].join(" ")}
							onMouseDown={(event) => {
								event.preventDefault();
								commit(option.value);
							}}
							type="button"
						>
							{option.label}
						</button>
					</li>
				))}
				{suggestions.length === 0 && (
					<li className="px-3 py-1.5 text-muted-foreground text-sm">
						No options found
					</li>
				)}
			</ul>
		</div>
	);

	const isActive = value !== "";

	return (
		<div className="relative shrink-0">
			<div className="flex shadow-sm">
				<button
					aria-controls={popoverId}
					aria-expanded={open}
					aria-label={label}
					className={[
						"flex h-10 max-w-52 items-center gap-2 border px-4 font-medium text-sm outline-none transition focus:ring-2",
						isActive ? "rounded-l-full" : "rounded-full",
						isActive
							? "border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-100/80 focus:border-emerald-500 focus:ring-emerald-500/20"
							: "border-slate-200 bg-white/95 text-slate-800 hover:bg-white focus:border-emerald-500 focus:ring-emerald-500/20",
					].join(" ")}
					onClick={() => setOpen((current) => !current)}
					ref={triggerRef}
					type="button"
				>
					<span className="truncate">{selectedLabel}</span>
					<ChevronDown className="size-4 shrink-0 text-slate-500" />
				</button>
				{isActive && (
					<button
						aria-label={`Clear ${label} filter`}
						className="flex h-10 w-10 items-center justify-center rounded-r-full border-emerald-300 border-y border-r bg-emerald-100 text-emerald-800 outline-none transition hover:bg-emerald-100/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
						onClick={() => commit("")}
						type="button"
					>
						<X className="size-4" />
					</button>
				)}
			</div>
			{typeof document === "undefined"
				? popover
				: createPortal(popover, document.body)}
		</div>
	);
}
