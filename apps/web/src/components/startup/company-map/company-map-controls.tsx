import { MapFilterBar } from "~/components/startup/company-map/map-filter-bar";
import { MapSearchInput } from "~/components/startup/company-map/map-search-input";
import type {
	CompanyMapFilterKey,
	CompanyMapFilterOptions,
	CompanyMapFilters,
} from "~/components/startup/company-map/types";

type CompanyMapControlsProps = {
	activeFilterCount: number;
	filterOptions: CompanyMapFilterOptions;
	filters: CompanyMapFilters;
	onClearFilters: () => void;
	onFilterChange: (key: CompanyMapFilterKey, value: string) => void;
	onOpenResults: () => void;
};

export function CompanyMapControls({
	activeFilterCount,
	filterOptions,
	filters,
	onClearFilters,
	onFilterChange,
	onOpenResults,
}: CompanyMapControlsProps) {
	return (
		<div className="absolute top-4 right-4 left-4 z-10 flex flex-col gap-3 md:flex-row md:items-start">
			<MapSearchInput
				onFocus={onOpenResults}
				onQueryChange={(value) => {
					onFilterChange("query", value);
					onOpenResults();
				}}
				query={filters.query}
			/>
			<MapFilterBar
				activeFilterCount={activeFilterCount}
				filterOptions={filterOptions}
				filters={filters}
				onClearFilters={onClearFilters}
				onFilterChange={(key, value) => {
					onFilterChange(key, value);
					onOpenResults();
				}}
			/>
		</div>
	);
}
