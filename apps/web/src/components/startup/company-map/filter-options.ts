import type {
	CompanyMapFilterOptions,
	FilterOption,
} from "~/components/startup/company-map/types";
import type { Company } from "~/lib/startup-api";

export function formatEnumLabel(value: string) {
	return value.replace(/_/g, " ").toLowerCase();
}

export function uniqueOptions(
	values: Array<string | null | undefined>,
): FilterOption[] {
	const options = values.filter((value): value is string => Boolean(value));
	return Array.from(new Set(options))
		.sort((first, second) => first.localeCompare(second))
		.map((value) => ({ label: value, value }));
}

export function getCompanyMapFilterOptions(
	companies: Company[],
): CompanyMapFilterOptions {
	return {
		cities: uniqueOptions(companies.map((company) => company.city)),
		counties: uniqueOptions(companies.map((company) => company.county)),
		sectors: uniqueOptions(companies.map((company) => company.sector)),
		stages: uniqueOptions(companies.map((company) => company.stage)).map(
			(option) => ({ ...option, label: formatEnumLabel(option.label) }),
		),
	};
}
