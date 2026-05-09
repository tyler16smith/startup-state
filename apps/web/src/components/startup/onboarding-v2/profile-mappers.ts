import type { CompanyMapFilters } from "~/components/startup/company-map/types";
import type {
	FounderProfileInput,
	InvestorProfileInput,
} from "~/lib/startup-api";

function firstValue(values: string[]) {
	return values.at(0);
}

function sizeKeywords(values: string[]) {
	return values.length ? `Company size: ${values.join(", ")}.` : "";
}

function locationKeywords(filters: CompanyMapFilters) {
	const locations = [...filters.city, ...filters.county];
	return locations.length ? `Locations: ${locations.join(", ")}.` : "";
}

export function selectedDropdownValueCount(filters: CompanyMapFilters) {
	return (
		filters.sector.length +
		filters.stage.length +
		filters.hiringStatus.length +
		filters.city.length +
		filters.county.length +
		filters.size.length
	);
}

export function mapFounderV2Profile(
	filters: CompanyMapFilters,
	description: string,
): FounderProfileInput {
	return {
		businessTypes: [],
		county: firstValue(filters.county),
		fundingNeeds: [],
		founderIdentities: [],
		goals: [],
		hiringStatus: firstValue(filters.hiringStatus),
		keywords: [
			description.trim(),
			sizeKeywords(filters.size),
			locationKeywords(filters),
		]
			.filter(Boolean)
			.join("\n"),
		sectors: filters.sector,
		stage: firstValue(filters.stage),
	};
}

function employeeRangeFromSizes(sizes: string[]) {
	const employeeMinimums = sizes.flatMap((size) => {
		if (size === "11-50") return [11];
		if (size === "51-200") return [51];
		if (size === "201+") return [201];
		return [];
	});
	const employeeMaximums = sizes.flatMap((size) => {
		if (size === "1-10") return [10];
		if (size === "11-50") return [50];
		if (size === "51-200") return [200];
		return [];
	});

	return {
		employeeMax: employeeMaximums.length
			? Math.max(...employeeMaximums)
			: undefined,
		employeeMin: employeeMinimums.length
			? Math.min(...employeeMinimums)
			: undefined,
	};
}

export function mapInvestorV2Profile(
	filters: CompanyMapFilters,
	description: string,
): InvestorProfileInput {
	const employees = employeeRangeFromSizes(filters.size);
	return {
		...employees,
		hiringStatuses: filters.hiringStatus,
		keywords: [description.trim(), locationKeywords(filters)]
			.filter(Boolean)
			.join("\n"),
		regions: [...filters.city, ...filters.county],
		researchGoals: [],
		sectors: filters.sector,
		stages: filters.stage,
	};
}
