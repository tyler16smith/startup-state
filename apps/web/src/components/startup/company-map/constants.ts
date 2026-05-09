import type {
	CompanyMapFilters,
	FilterOption,
} from "~/components/startup/company-map/types";

export const COMPANY_SOURCE_ID = "startup-companies";
export const COMPANY_CLUSTERS_LAYER_ID = "startup-company-clusters";
export const COMPANY_CLUSTER_COUNT_LAYER_ID = "startup-company-cluster-count";

export const DEFAULT_COMPANY_MAP_FILTERS: CompanyMapFilters = {
	city: [],
	county: [],
	hiringStatus: [],
	query: "",
	sector: [],
	size: [],
	stage: [],
};

export const HIRING_STATUS_OPTIONS: FilterOption[] = [
	{ label: "actively hiring", value: "ACTIVELY_HIRING" },
	{ label: "hiring", value: "HIRING" },
	{ label: "not hiring", value: "NOT_HIRING" },
	{ label: "unknown", value: "UNKNOWN" },
];

export const COMPANY_SIZE_OPTIONS: FilterOption[] = [
	{ label: "1-10", value: "1-10" },
	{ label: "11-50", value: "11-50" },
	{ label: "51-200", value: "51-200" },
	{ label: "201+", value: "201+" },
];
