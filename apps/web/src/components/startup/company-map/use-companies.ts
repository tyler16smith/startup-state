"use client";

import { useEffect, useState } from "react";
import { apiClient, type Company, type Paginated } from "~/lib/startup-api";

export function useCompanies() {
	const [companies, setCompanies] = useState<Company[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		apiClient<Paginated<Company>>("/api/v1/companies/list?limit=100")
			.then((data) => {
				if (!cancelled) setCompanies(data.items);
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
