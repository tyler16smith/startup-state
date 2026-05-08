"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_COMPANY_MAP_FILTERS } from "~/components/startup/company-map/constants";
import { getInitialCompanyMapFilters } from "~/components/startup/company-map/filter-companies";
import type {
	CompanyMapFilterKey,
	CompanyMapFilters,
} from "~/components/startup/company-map/types";

export function useCompanyFilters() {
	const [filters, setFilters] = useState<CompanyMapFilters>(
		DEFAULT_COMPANY_MAP_FILTERS,
	);

	useEffect(() => {
		setFilters(getInitialCompanyMapFilters(window.location.search));
	}, []);

	const updateFilter = useCallback(
		(key: CompanyMapFilterKey, value: string) => {
			setFilters((current) => ({ ...current, [key]: value }));
		},
		[],
	);

	const clearFilters = useCallback(() => {
		setFilters({ ...DEFAULT_COMPANY_MAP_FILTERS });
	}, []);

	return { clearFilters, filters, updateFilter };
}
