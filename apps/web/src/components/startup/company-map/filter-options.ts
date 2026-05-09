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
	const seen = new Map<string, string>();
	for (const value of values) {
		if (!value) continue;
		const key = value.trim().toLocaleLowerCase();
		if (!seen.has(key)) seen.set(key, value);
	}
	return Array.from(seen.values())
		.sort((first, second) =>
			first
				.trim()
				.toLocaleLowerCase()
				.localeCompare(second.trim().toLocaleLowerCase()),
		)
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
