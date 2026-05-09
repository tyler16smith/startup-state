"use client";

import { MapFilterBar } from "~/components/startup/company-map/map-filter-bar";
import type {
	CompanyMapArrayFilterKey,
	CompanyMapFilterOptions,
	CompanyMapFilters,
} from "~/components/startup/company-map/types";

type CompanyDetailsSectionProps = {
	activeFilterCount: number;
	filterOptions: CompanyMapFilterOptions;
	filters: CompanyMapFilters;
	onClearFilter: (key: CompanyMapArrayFilterKey) => void;
	onClearFilters: () => void;
	onToggleFilter: (key: CompanyMapArrayFilterKey, value: string) => void;
};

export function CompanyDetailsSection({
	activeFilterCount,
	filterOptions,
	filters,
	onClearFilter,
	onClearFilters,
	onToggleFilter,
}: CompanyDetailsSectionProps) {
	return (
		<section className="space-y-4">
			<div className="space-y-1">
				<h2 className="font-semibold text-lg tracking-normal">
					Company details
				</h2>
				<p className="text-muted-foreground text-sm">
					Choose the signals that best describe the company.
				</p>
			</div>
			<MapFilterBar
				activeFilterCount={activeFilterCount}
				filterOptions={filterOptions}
				filters={filters}
				onClearFilter={onClearFilter}
				onClearFilters={onClearFilters}
				onToggleFilter={onToggleFilter}
			/>
		</section>
	);
}
