import { MapFilterBar } from "~/components/startup/company-map/map-filter-bar";
import { MapSearchInput } from "~/components/startup/company-map/map-search-input";
import type {
	CompanyMapArrayFilterKey,
	CompanyMapFilterOptions,
	CompanyMapFilters,
} from "~/components/startup/company-map/types";

type CompanyMapControlsProps = {
	activeFilterCount: number;
	filterOptions: CompanyMapFilterOptions;
	filters: CompanyMapFilters;
	onClearFilter: (key: CompanyMapArrayFilterKey) => void;
	onClearFilters: () => void;
	onOpenResults: () => void;
	onQueryChange: (value: string) => void;
	onToggleFilter: (key: CompanyMapArrayFilterKey, value: string) => void;
};

export function CompanyMapControls({
	activeFilterCount,
	filterOptions,
	filters,
	onClearFilter,
	onClearFilters,
	onOpenResults,
	onQueryChange,
	onToggleFilter,
}: CompanyMapControlsProps) {
	return (
		<div className="absolute top-4 right-4 left-4 z-40 flex flex-col gap-3 md:flex-row md:items-start">
			<MapSearchInput
				onFocus={onOpenResults}
				onQueryChange={(value) => {
					onQueryChange(value);
					onOpenResults();
				}}
				query={filters.query}
			/>
			<MapFilterBar
				activeFilterCount={activeFilterCount}
				filterOptions={filterOptions}
				filters={filters}
				onClearFilter={(key) => {
					onClearFilter(key);
					onOpenResults();
				}}
				onClearFilters={onClearFilters}
				onToggleFilter={(key, value) => {
					onToggleFilter(key, value);
					onOpenResults();
				}}
			/>
		</div>
	);
}
