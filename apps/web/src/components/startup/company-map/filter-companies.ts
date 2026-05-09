import { DEFAULT_COMPANY_MAP_FILTERS } from "~/components/startup/company-map/constants";
import type { CompanyMapFilters } from "~/components/startup/company-map/types";
import type { Company } from "~/lib/startup-api";

export function getInitialCompanyMapFilters(search: string): CompanyMapFilters {
	const params = new URLSearchParams(search);
	const employeeMin = params.get("employeeMin");
	const employeeMax = params.get("employeeMax");

	const size = params.getAll("size");
	if (employeeMin === "201") size.push("201+");
	else if (employeeMin === "51" && employeeMax === "200") size.push("51-200");
	else if (employeeMin === "11" && employeeMax === "50") size.push("11-50");
	else if (employeeMax === "10") size.push("1-10");

	return {
		...DEFAULT_COMPANY_MAP_FILTERS,
		city: params.getAll("city"),
		county: params.getAll("county"),
		hiringStatus: params.getAll("hiringStatus"),
		query: params.get("q") ?? "",
		sector: params.getAll("sector"),
		size,
		stage: params.getAll("stage"),
	};
}

export function getActiveFilterCount(filters: CompanyMapFilters) {
	return Object.entries(filters).reduce((count, [key, value]) => {
		if (key === "query") return count + (value ? 1 : 0);
		return count + (Array.isArray(value) ? value.length : 0);
	}, 0);
}

function matchesSelectedValue(
	selected: string[],
	value: string | null | undefined,
) {
	if (selected.length === 0) return true;
	if (!value) return false;
	return selected.some((item) => item.toLowerCase() === value.toLowerCase());
}

function matchesSelectedSize(company: Company, selected: string[]) {
	if (selected.length === 0) return true;
	const employeeCount = company.employees ?? null;
	const employeeRange = company.employeeRange?.toLowerCase();

	return selected.some((size) => {
		const employeeRangeMatches = employeeRange === size.toLowerCase();
		return (
			employeeRangeMatches ||
			(size === "1-10" && employeeCount !== null && employeeCount <= 10) ||
			(size === "11-50" &&
				employeeCount !== null &&
				employeeCount >= 11 &&
				employeeCount <= 50) ||
			(size === "51-200" &&
				employeeCount !== null &&
				employeeCount >= 51 &&
				employeeCount <= 200) ||
			(size === "201+" && employeeCount !== null && employeeCount >= 201)
		);
	});
}

export function companyMatchesFilters(
	company: Company,
	filters: CompanyMapFilters,
) {
	const query = filters.query.toLowerCase();
	const haystack =
		`${company.name} ${company.description ?? ""} ${company.address ?? ""} ${company.city ?? ""} ${company.county ?? ""} ${company.sector ?? ""}`.toLowerCase();

	return (
		(!query || haystack.includes(query)) &&
		matchesSelectedValue(filters.sector, company.sector) &&
		matchesSelectedValue(filters.stage, company.stage) &&
		matchesSelectedValue(filters.hiringStatus, company.hiringStatus) &&
		matchesSelectedValue(filters.city, company.city) &&
		matchesSelectedValue(filters.county, company.county) &&
		matchesSelectedSize(company, filters.size)
	);
}

export function filterCompanies(
	companies: Company[],
	filters: CompanyMapFilters,
) {
	return companies.filter((company) => companyMatchesFilters(company, filters));
}
