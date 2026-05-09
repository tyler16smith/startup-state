"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStartupStateAIPanel } from "~/components/agent/startup-state-ai-context";
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
import { PresentationModeButton } from "~/components/startup/company-map/presentation-mode-button";
import { PresentationSummary } from "~/components/startup/company-map/presentation-summary";
import { ResultsPanel } from "~/components/startup/company-map/results-panel";
import { SelectedCompanyPanel } from "~/components/startup/company-map/selected-company-panel";
import { useCompanies } from "~/components/startup/company-map/use-companies";
import { useCompanyFilters } from "~/components/startup/company-map/use-company-filters";
import { useCompanyMapbox } from "~/components/startup/company-map/use-company-mapbox";
import { useFullscreenLock } from "~/components/startup/company-map/use-fullscreen-lock";
import { apiClient, type Company } from "~/lib/startup-api";

export function CompanyMap({ token }: { token?: string }) {
	const { companies, loading } = useCompanies();
	const {
		clearFilters: clearFilterState,
		filters,
		setFilterValues,
		toggleFilterValue,
		updateQuery,
	} = useCompanyFilters();
	const [selected, setSelected] = useState<Company | null>(null);
	const [selectedDetail, setSelectedDetail] = useState<Company | null>(null);
	const [selectedDetailLoading, setSelectedDetailLoading] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isPresentationMode, setIsPresentationMode] = useState(false);
	const [resultsOpen, setResultsOpen] = useState(false);
	const selectedCompanyId = selected?.id;
	const selectedPanelCompany = selectedDetail ?? selected;
	const { close: closeAgentPanel } = useStartupStateAIPanel();

	useEffect(() => {
		if (isFullscreen) {
			closeAgentPanel();
		}
	}, [isFullscreen, closeAgentPanel]);

	const filtered = useMemo(
		() => filterCompanies(companies, filters),
		[companies, filters],
	);
	const mapCompanies = isPresentationMode ? companies : filtered;
	const companiesById = useMemo(
		() => new Map(mapCompanies.map((company) => [company.id, company])),
		[mapCompanies],
	);
	const companyFeatureCollection = useMemo(
		() => createCompanyFeatureCollection(mapCompanies),
		[mapCompanies],
	);
	const filterOptions = useMemo(
		() => getCompanyMapFilterOptions(companies),
		[companies],
	);
	const activeFilterCount = getActiveFilterCount(filters);

	const handleMarkerCompanyClick = useCallback((company: Company) => {
		setSelected(company);
		setResultsOpen(false);
	}, []);

	const { flyToCompany, mapRef } = useCompanyMapbox({
		companiesById,
		companyFeatureCollection,
		isFullscreen,
		isPresentationMode,
		onCompanyClick: handleMarkerCompanyClick,
		selectedCompany: selected,
		selectedCompanyId,
		token,
	});

	useFullscreenLock(isFullscreen, setIsFullscreen);

	const focusCompany = useCallback(
		(company: Company) => {
			setSelected(company);
			setResultsOpen(false);
			flyToCompany(company);
		},
		[flyToCompany],
	);

	useEffect(() => {
		if (!selectedCompanyId) {
			setSelectedDetail(null);
			setSelectedDetailLoading(false);
			return;
		}

		let cancelled = false;
		setSelectedDetail(null);
		setSelectedDetailLoading(true);

		apiClient<Company>(
			`/api/v1/companies/get?id=${encodeURIComponent(selectedCompanyId)}`,
		)
			.then((company) => {
				if (!cancelled) setSelectedDetail(company);
			})
			.catch(() => {
				if (!cancelled) setSelectedDetail(null);
			})
			.finally(() => {
				if (!cancelled) setSelectedDetailLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [selectedCompanyId]);

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

	const togglePresentationMode = useCallback(() => {
		if (isPresentationMode) {
			setIsPresentationMode(false);
			return;
		}

		setIsPresentationMode(true);
		setIsFullscreen(true);
		setResultsOpen(false);
		setSelected(null);
		setSelectedDetail(null);
	}, [isPresentationMode]);

	useEffect(() => {
		if (!isFullscreen) setIsPresentationMode(false);
	}, [isFullscreen]);

	const closeSelectedCompany = useCallback(() => {
		setSelected(null);
		setSelectedDetail(null);
	}, []);

	return (
		<div
			className={[
				"overflow-hidden bg-slate-100 transition-all duration-300 ease-out",
				isFullscreen
					? "fixed inset-0 z-[60] h-screen w-screen"
					: "relative h-full min-h-0",
				isPresentationMode ? "map-presentation-mode" : "",
			].join(" ")}
		>
			{token ? <div className="h-full min-h-0" ref={mapRef} /> : null}
			{!token && <MissingTokenState />}
			{loading && <LoadingOverlay />}
			<PresentationModeButton
				isPresentationMode={isPresentationMode}
				onToggle={togglePresentationMode}
			/>
			{!isPresentationMode && (
				<FullscreenButton
					isFullscreen={isFullscreen}
					onToggle={() => setIsFullscreen((current) => !current)}
				/>
			)}
			{isPresentationMode && (
				<PresentationSummary startupCount={companies.length} />
			)}
			{!isPresentationMode && (
				<>
					<CompanyMapControls
						activeFilterCount={activeFilterCount}
						filterOptions={filterOptions}
						filters={filters}
						onClearFilter={(key) => setFilterValues(key, [])}
						onClearFilters={clearFilters}
						onOpenResults={() => setResultsOpen(true)}
						onQueryChange={updateQuery}
						onToggleFilter={toggleFilterValue}
					/>
					<SelectedCompanyPanel
						company={selectedPanelCompany}
						loading={selectedDetailLoading}
						mapToken={token}
						onClose={closeSelectedCompany}
					/>
					<ResultsPanel
						activeFilterCount={activeFilterCount}
						companies={filtered}
						onClearSelected={closeSelectedCompany}
						onClose={() => setResultsOpen(false)}
						onFocusCompany={focusCompany}
						open={resultsOpen}
						selectedCompanyId={selectedCompanyId}
					/>
				</>
			)}
		</div>
	);
}
