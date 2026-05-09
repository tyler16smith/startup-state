import { ChevronDown, X } from "lucide-react";
import {
	COMPANY_SIZE_OPTIONS,
	HIRING_STATUS_OPTIONS,
} from "~/components/startup/company-map/constants";
import type {
	CompanyMapArrayFilterKey,
	CompanyMapFilterOptions,
	CompanyMapFilters,
	FilterOption,
} from "~/components/startup/company-map/types";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";

type MapFilterBarProps = {
	activeFilterCount: number;
	filterOptions: CompanyMapFilterOptions;
	filters: CompanyMapFilters;
	onClearFilters: () => void;
	onClearFilter: (key: CompanyMapArrayFilterKey) => void;
	onToggleFilter: (key: CompanyMapArrayFilterKey, value: string) => void;
};

export function MapFilterBar({
	activeFilterCount,
	filterOptions,
	filters,
	onClearFilter,
	onClearFilters,
	onToggleFilter,
}: MapFilterBarProps) {
	const filterConfig = [
		{ key: "sector", label: "Sector", options: filterOptions.sectors },
		{ key: "stage", label: "Stage", options: filterOptions.stages },
		{ key: "hiringStatus", label: "Hiring", options: HIRING_STATUS_OPTIONS },
		{ key: "city", label: "City", options: filterOptions.cities },
		{ key: "county", label: "County", options: filterOptions.counties },
		{ key: "size", label: "Size", options: COMPANY_SIZE_OPTIONS },
	] as const;

	return (
		<div className="flex gap-2 overflow-x-auto pb-2">
			{filterConfig.map((filter) => (
				<MapFilterDropdown
					key={filter.key}
					label={filter.label}
					onClear={() => onClearFilter(filter.key)}
					onToggle={(value) => onToggleFilter(filter.key, value)}
					options={filter.options}
					selected={filters[filter.key]}
				/>
			))}
			{activeFilterCount > 0 && (
				<Button
					className="h-10 shrink-0 rounded-full border-emerald-300 bg-emerald-100 px-4 text-emerald-900 shadow-sm hover:bg-emerald-100/80"
					onClick={onClearFilters}
					variant="outline"
				>
					Reset all
				</Button>
			)}
		</div>
	);
}

function MapFilterDropdown({
	label,
	onClear,
	onToggle,
	options,
	selected,
}: {
	label: string;
	onClear: () => void;
	onToggle: (value: string) => void;
	options: FilterOption[];
	selected: string[];
}) {
	const isActive = selected.length > 0;

	return (
		<div className="relative shrink-0">
			<div className="flex">
				<Popover>
					<PopoverTrigger asChild>
						<Button
							className={[
								"h-10 max-w-52 justify-between rounded-full px-4 shadow-md",
								isActive
									? "rounded-r-none border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-100/80"
									: "border-slate-200 bg-white/95 text-slate-800 hover:bg-white",
							].join(" ")}
							type="button"
							variant="outline"
						>
							<span className="truncate">
								{label}
								{selected.length ? ` (${selected.length})` : ""}
							</span>
							<ChevronDown className="size-4 text-slate-500" />
						</Button>
					</PopoverTrigger>
					<PopoverContent align="start" className="z-[90] w-72 p-2">
						<div className="max-h-72 space-y-1 overflow-auto">
							{options.length ? (
								options.map((option) => (
									<Label
										className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
										key={option.value}
									>
										<Checkbox
											checked={selected.includes(option.value)}
											onCheckedChange={() => onToggle(option.value)}
										/>
										<span className="line-clamp-2">{option.label}</span>
									</Label>
								))
							) : (
								<p className="px-2 py-6 text-center text-muted-foreground text-sm">
									No options yet
								</p>
							)}
						</div>
						{selected.length ? (
							<div className="mt-2 flex flex-wrap gap-1 border-t pt-2">
								{selected.map((value) => (
									<Badge className="rounded-md" key={value} variant="secondary">
										{options.find((option) => option.value === value)?.label ??
											value}
									</Badge>
								))}
							</div>
						) : null}
					</PopoverContent>
				</Popover>
				{isActive && (
					<button
						aria-label={`Clear ${label} filter`}
						className="flex h-10 w-10 items-center justify-center rounded-r-full border-emerald-300 border-y border-r bg-emerald-100 text-emerald-800 outline-none transition hover:bg-emerald-100/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
						onClick={onClear}
						type="button"
					>
						<X className="size-4" />
					</button>
				)}
			</div>
		</div>
	);
}
