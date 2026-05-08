import { DEFAULT_COMPANY_MAP_FILTERS } from "~/components/startup/company-map/constants";
import type { CompanyMapFilters } from "~/components/startup/company-map/types";
import type { Company } from "~/lib/startup-api";

export function getInitialCompanyMapFilters(search: string): CompanyMapFilters {
	const params = new URLSearchParams(search);
	const employeeMin = params.get("employeeMin");
	const employeeMax = params.get("employeeMax");

	let size = "";
	if (employeeMin === "201") size = "201+";
	else if (employeeMin === "51" && employeeMax === "200") size = "51-200";
	else if (employeeMin === "11" && employeeMax === "50") size = "11-50";
	else if (employeeMax === "10") size = "1-10";

	return {
		...DEFAULT_COMPANY_MAP_FILTERS,
		city: params.get("city") ?? "",
		county: params.get("county") ?? "",
		hiringStatus: params.get("hiringStatus") ?? "",
		query: params.get("q") ?? "",
		sector: params.get("sector") ?? "",
		size,
		stage: params.get("stage") ?? "",
	};
}

export function getActiveFilterCount(filters: CompanyMapFilters) {
	return Object.values(filters).filter(Boolean).length;
}

export function companyMatchesFilters(
	company: Company,
	filters: CompanyMapFilters,
) {
	const query = filters.query.toLowerCase();
	const haystack =
		`${company.name} ${company.description ?? ""} ${company.city ?? ""} ${company.county ?? ""} ${company.sector ?? ""}`.toLowerCase();
	const employeeCount = company.employees ?? null;
	const employeeRangeMatches =
		company.employeeRange?.toLowerCase() === filters.size.toLowerCase();
	const sizeMatches =
		!filters.size ||
		(filters.size === "1-10" &&
			employeeCount !== null &&
			employeeCount <= 10) ||
		(filters.size === "11-50" &&
			employeeCount !== null &&
			employeeCount >= 11 &&
			employeeCount <= 50) ||
		(filters.size === "51-200" &&
			employeeCount !== null &&
			employeeCount >= 51 &&
			employeeCount <= 200) ||
		(filters.size === "201+" &&
			employeeCount !== null &&
			employeeCount >= 201) ||
		employeeRangeMatches;

	return (
		(!query || haystack.includes(query)) &&
		(!filters.sector ||
			company.sector?.toLowerCase() === filters.sector.toLowerCase()) &&
		(!filters.stage ||
			company.stage?.toLowerCase() === filters.stage.toLowerCase()) &&
		(!filters.hiringStatus || company.hiringStatus === filters.hiringStatus) &&
		(!filters.city ||
			company.city?.toLowerCase() === filters.city.toLowerCase()) &&
		(!filters.county ||
			company.county?.toLowerCase() === filters.county.toLowerCase()) &&
		sizeMatches
	);
}

export function filterCompanies(
	companies: Company[],
	filters: CompanyMapFilters,
) {
	return companies.filter((company) => companyMatchesFilters(company, filters));
}
