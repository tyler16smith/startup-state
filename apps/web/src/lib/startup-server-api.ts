import "server-only";

import { getServerFetchOptions } from "~/lib/server-api";
import {
	type Company,
	type NavigatorPlan,
	type Paginated,
	parseApiResponse,
	type Resource,
	type ResourceTaxonomy,
} from "~/lib/startup-api";
import { getServerApiBaseUrl } from "~/server/api-url";

function queryString(params?: Record<string, unknown>) {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params ?? {})) {
		if (value === undefined || value === null || value === "") continue;
		if (Array.isArray(value)) {
			for (const item of value) {
				if (item !== undefined && item !== null && item !== "") {
					search.append(key, String(item));
				}
			}
			continue;
		}
		search.set(key, String(value));
	}
	const value = search.toString();
	return value ? `?${value}` : "";
}

export async function apiServer<T>(
	path: string,
	params?: Record<string, unknown>,
): Promise<T> {
	const options = await getServerFetchOptions();
	const response = await fetch(
		`${getServerApiBaseUrl()}${path}${queryString(params)}`,
		{ ...options, cache: "no-store" },
	);
	return parseApiResponse<T>(response);
}

export function listResources(params?: Record<string, unknown>) {
	return apiServer<Paginated<Resource>>("/api/v1/resources/list", params);
}

export function getResourceTaxonomy() {
	return apiServer<ResourceTaxonomy>("/api/v1/resources/taxonomy");
}

export function getResource(idOrSlug: string) {
	return apiServer<Resource>("/api/v1/resources/get", {
		id: idOrSlug,
		slug: idOrSlug,
	});
}

export function listCompanies(params?: Record<string, unknown>) {
	return apiServer<Paginated<Company>>("/api/v1/companies/list", params);
}

export function getCompany(idOrSlug: string) {
	return apiServer<Company>("/api/v1/companies/get", {
		id: idOrSlug,
		slug: idOrSlug,
	});
}

export function getLatestNavigatorPlan() {
	return apiServer<NavigatorPlan | null>("/api/v1/navigatorPlans/latest");
}
