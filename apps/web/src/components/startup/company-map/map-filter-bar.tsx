import {
	COMPANY_SIZE_OPTIONS,
	HIRING_STATUS_OPTIONS,
} from "~/components/startup/company-map/constants";
import { FilterSelect } from "~/components/startup/company-map/filter-select";
import type {
	CompanyMapFilterKey,
	CompanyMapFilterOptions,
	CompanyMapFilters,
} from "~/components/startup/company-map/types";
import { Button } from "~/components/ui/button";

type MapFilterBarProps = {
	activeFilterCount: number;
	filterOptions: CompanyMapFilterOptions;
	filters: CompanyMapFilters;
	onClearFilters: () => void;
	onFilterChange: (key: CompanyMapFilterKey, value: string) => void;
};

export function MapFilterBar({
	activeFilterCount,
	filterOptions,
	filters,
	onClearFilters,
	onFilterChange,
}: MapFilterBarProps) {
	return (
		<div className="flex gap-2 overflow-x-auto pb-2">
			<FilterSelect
				label="Sector"
				onChange={(value) => onFilterChange("sector", value)}
				options={filterOptions.sectors}
				value={filters.sector}
			/>
			<FilterSelect
				label="Stage"
				onChange={(value) => onFilterChange("stage", value)}
				options={filterOptions.stages}
				value={filters.stage}
			/>
			<FilterSelect
				label="Hiring"
				onChange={(value) => onFilterChange("hiringStatus", value)}
				options={HIRING_STATUS_OPTIONS}
				value={filters.hiringStatus}
			/>
			<FilterSelect
				label="City"
				onChange={(value) => onFilterChange("city", value)}
				options={filterOptions.cities}
				value={filters.city}
			/>
			<FilterSelect
				label="County"
				onChange={(value) => onFilterChange("county", value)}
				options={filterOptions.counties}
				value={filters.county}
			/>
			<FilterSelect
				label="Size"
				onChange={(value) => onFilterChange("size", value)}
				options={COMPANY_SIZE_OPTIONS}
				value={filters.size}
			/>
			{activeFilterCount > 0 && (
				<Button
					className="h-10 shrink-0 rounded-full bg-white/95 px-4 shadow-sm"
					onClick={onClearFilters}
					variant="outline"
				>
					Clear
				</Button>
			)}
		</div>
	);
}
