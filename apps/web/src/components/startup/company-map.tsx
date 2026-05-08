"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CompanyMapControls } from "~/components/startup/company-map/company-map-controls";
import {
	filterCompanies,
	getActiveFilterCount,
} from "~/components/startup/company-map/filter-companies";
import { getCompanyMapFilterOptions } from "~/components/startup/company-map/filter-options";
import { FullscreenButton } from "~/components/startup/company-map/fullscreen-button";
import { LoadingOverlay } from "~/components/startup/company-map/loading-overlay";
import { createCompanyFeatureCollection } from "~/components/startup/company-map/map-data";
import { MissingTokenState } from "~/components/startup/company-map/missing-token-state";
import { ResultsPanel } from "~/components/startup/company-map/results-panel";
import { useCompanies } from "~/components/startup/company-map/use-companies";
import { useCompanyFilters } from "~/components/startup/company-map/use-company-filters";
import { useCompanyMapbox } from "~/components/startup/company-map/use-company-mapbox";
import { useFullscreenLock } from "~/components/startup/company-map/use-fullscreen-lock";
import type { Company } from "~/lib/startup-api";

export function CompanyMap({ token }: { token?: string }) {
	const { companies, loading } = useCompanies();
	const {
		clearFilters: clearFilterState,
		filters,
		updateFilter,
	} = useCompanyFilters();
	const [selected, setSelected] = useState<Company | null>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [resultsOpen, setResultsOpen] = useState(false);
	const selectedCompanyId = selected?.id;

	const filtered = useMemo(
		() => filterCompanies(companies, filters),
		[companies, filters],
	);
	const companiesById = useMemo(
		() => new Map(filtered.map((company) => [company.id, company])),
		[filtered],
	);
	const companyFeatureCollection = useMemo(
		() => createCompanyFeatureCollection(filtered),
		[filtered],
	);
	const filterOptions = useMemo(
		() => getCompanyMapFilterOptions(companies),
		[companies],
	);
	const activeFilterCount = getActiveFilterCount(filters);

	const handleMarkerCompanyClick = useCallback((company: Company) => {
		setSelected(company);
		setResultsOpen(true);
	}, []);

	const { flyToCompany, mapRef } = useCompanyMapbox({
		companiesById,
		companyFeatureCollection,
		isFullscreen,
		onCompanyClick: handleMarkerCompanyClick,
		token,
	});

	useFullscreenLock(isFullscreen, setIsFullscreen);

	const focusCompany = useCallback(
		(company: Company) => {
			setSelected(company);
			setResultsOpen(true);
			flyToCompany(company);
		},
		[flyToCompany],
	);

	useEffect(() => {
		if (!selectedCompanyId) return;
		if (!filtered.some((company) => company.id === selectedCompanyId)) {
			setSelected(null);
		}
	}, [filtered, selectedCompanyId]);

	const clearFilters = useCallback(() => {
		clearFilterState();
		setSelected(null);
	}, [clearFilterState]);

	return (
		<div
			className={[
				"overflow-hidden bg-slate-100 transition-all duration-300 ease-out",
				isFullscreen
					? "fixed inset-0 z-[60] h-screen w-screen"
					: "relative h-full min-h-0",
			].join(" ")}
		>
			{token ? <div className="h-full min-h-0" ref={mapRef} /> : null}
			{!token && <MissingTokenState />}
			{loading && <LoadingOverlay />}
			<FullscreenButton
				isFullscreen={isFullscreen}
				onToggle={() => setIsFullscreen((current) => !current)}
			/>
			<CompanyMapControls
				activeFilterCount={activeFilterCount}
				filterOptions={filterOptions}
				filters={filters}
				onClearFilters={clearFilters}
				onFilterChange={updateFilter}
				onOpenResults={() => setResultsOpen(true)}
			/>
			<ResultsPanel
				activeFilterCount={activeFilterCount}
				companies={filtered}
				onClearSelected={() => setSelected(null)}
				onClose={() => setResultsOpen(false)}
				onFocusCompany={focusCompany}
				open={resultsOpen}
				selectedCompanyId={selectedCompanyId}
			/>
		</div>
	);
}
