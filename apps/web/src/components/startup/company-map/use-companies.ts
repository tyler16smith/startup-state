"use client";

import { useEffect, useState } from "react";
import { apiClient, type Company, type Paginated } from "~/lib/startup-api";

const COMPANY_PAGE_LIMIT = 100;

async function fetchCompanyPage(offset: number) {
	return apiClient<Paginated<Company>>(
		`/api/v1/companies/list?limit=${COMPANY_PAGE_LIMIT}&offset=${offset}&sort=name`,
	);
}

async function fetchAllCompanies() {
	const firstPage = await fetchCompanyPage(0);
	const companies = [...firstPage.items];

	for (
		let offset = firstPage.offset + firstPage.limit;
		offset < firstPage.total;
		offset += firstPage.limit
	) {
		const page = await fetchCompanyPage(offset);
		companies.push(...page.items);
	}

	return companies;
}

export function useCompanies() {
	const [companies, setCompanies] = useState<Company[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		fetchAllCompanies()
			.then((items) => {
				if (!cancelled) setCompanies(items);
			})
			.catch(() => {
				if (!cancelled) setCompanies([]);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return { companies, loading };
}
