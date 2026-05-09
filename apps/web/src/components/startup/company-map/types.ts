export type FilterOption = {
	label: string;
	value: string;
};

export type CompanyMapFilters = {
	query: string;
	sector: string[];
	stage: string[];
	hiringStatus: string[];
	city: string[];
	county: string[];
	size: string[];
};

export type CompanyMapFilterKey = keyof CompanyMapFilters;
export type CompanyMapArrayFilterKey = Exclude<CompanyMapFilterKey, "query">;

export type CompanyMapFilterOptions = {
	sectors: FilterOption[];
	stages: FilterOption[];
	cities: FilterOption[];
	counties: FilterOption[];
};

export type CompanyMapBounds = {
	east: number;
	north: number;
	south: number;
	west: number;
};

export type CompanyFeature = {
	type: "Feature";
	geometry: {
		type: "Point";
		coordinates: [number, number];
	};
	properties: {
		companyId: string;
		name: string;
	};
};

export type CompanyFeatureCollection = {
	type: "FeatureCollection";
	features: CompanyFeature[];
};
