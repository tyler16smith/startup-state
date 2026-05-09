"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_COMPANY_MAP_FILTERS } from "~/components/startup/company-map/constants";
import { getInitialCompanyMapFilters } from "~/components/startup/company-map/filter-companies";
import type {
	CompanyMapArrayFilterKey,
	CompanyMapFilters,
} from "~/components/startup/company-map/types";

export function useCompanyFilters() {
	const [filters, setFilters] = useState<CompanyMapFilters>(
		DEFAULT_COMPANY_MAP_FILTERS,
	);

	useEffect(() => {
		setFilters(getInitialCompanyMapFilters(window.location.search));
	}, []);

	const updateQuery = useCallback((value: string) => {
		setFilters((current) => ({ ...current, query: value }));
	}, []);

	const setFilterValues = useCallback(
		(key: CompanyMapArrayFilterKey, values: string[]) => {
			setFilters((current) => ({ ...current, [key]: values }));
		},
		[],
	);

	const toggleFilterValue = useCallback(
		(key: CompanyMapArrayFilterKey, value: string) => {
			setFilters((current) => {
				const values = current[key];
				return {
					...current,
					[key]: values.includes(value)
						? values.filter((item) => item !== value)
						: [...values, value],
				};
			});
		},
		[],
	);

	const clearFilters = useCallback(() => {
		setFilters({ ...DEFAULT_COMPANY_MAP_FILTERS });
	}, []);

	return {
		clearFilters,
		filters,
		setFilterValues,
		toggleFilterValue,
		updateQuery,
	};
}
