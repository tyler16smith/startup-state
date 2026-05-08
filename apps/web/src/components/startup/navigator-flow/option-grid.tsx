"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

export type NavigatorOption = {
	id: string;
	label: string;
	description?: string;
	icon: LucideIcon;
};

export function OptionGrid({
	options,
	selected,
	onToggle,
	columns = "two",
}: {
	options: NavigatorOption[];
	selected: string[];
	onToggle: (id: string) => void;
	columns?: "two" | "four";
}) {
	return (
		<div
			className={cn(
				"grid gap-3",
				columns === "four" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2",
			)}
		>
			{options.map(({ id, label, description, icon: Icon }) => {
				const isSelected = selected.includes(id);
				return (
					<button
						className={cn(
							"flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border-2 bg-white p-4 text-center transition-all hover:bg-emerald-50",
							isSelected
								? "border-emerald-900 bg-emerald-50"
								: "border-slate-300",
						)}
						key={id}
						onClick={() => onToggle(id)}
						type="button"
					>
						<Icon
							className={cn(
								"size-6",
								isSelected ? "text-emerald-800" : "text-muted-foreground",
							)}
						/>
						<span className="font-medium text-sm">{label}</span>
						{description && (
							<span className="text-muted-foreground text-xs leading-snug">
								{description}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
