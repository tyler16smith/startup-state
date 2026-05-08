import { getCsrfToken } from "@app/client-ts";
import { toApiUrl } from "~/lib/api-url";

export type Resource = {
	id: string;
	name: string;
	slug: string;
	description: string;
	shortDescription?: string | null;
	websiteUrl?: string | null;
	contactName?: string | null;
	contactEmail?: string | null;
	contactPhone?: string | null;
	category?: string | null;
	subcategory?: string | null;
	status: string;
	stages: string[];
	communities: string[];
	sectors: string[];
	goals: string[];
	regions: string[];
	businessTypes: string[];
	eligibilityTags: string[];
	city?: string | null;
	county?: string | null;
	state?: string | null;
	sourceId?: string | null;
	lastSyncedAt?: string | null;
	updatedAt: string;
	isSaved?: boolean;
	related?: Resource[];
};

export type CompanyPhoto = {
	id?: string;
	url: string;
	altText?: string | null;
	sortOrder?: number;
};

export type Company = {
	id: string;
	name: string;
	slug: string;
	websiteUrl?: string | null;
	linkedinUrl?: string | null;
	description?: string | null;
	sector?: string | null;
	stage?: string | null;
	employees?: number | null;
	employeeRange?: string | null;
	yearFounded?: number | null;
	address?: string | null;
	city?: string | null;
	county?: string | null;
	state?: string | null;
	postalCode?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	hiringStatus: string;
	jobPostingsUrl?: string | null;
	status: string;
	photos: CompanyPhoto[];
	related?: Company[];
	updatedAt: string;
};

export type FounderProfileInput = {
	stage?: string;
	city?: string;
	county?: string;
	region?: string;
	sectors: string[];
	goals: string[];
	businessTypes: string[];
	fundingNeeds: string[];
	hiringStatus?: string;
	keywords?: string;
	founderIdentities?: string[];
};

export type InvestorProfileInput = {
	stages: string[];
	sectors: string[];
	regions: string[];
	hiringStatuses: string[];
	employeeMin?: number;
	employeeMax?: number;
	researchGoals: string[];
	keywords?: string;
};

export type ResourceRecommendation = {
	resource: Resource;
	score: number;
	reasons: string[];
	matchedFields: {
		stage?: boolean;
		goals?: string[];
		sectors?: string[];
		regions?: string[];
		businessTypes?: string[];
		founderIdentities?: string[];
	};
};

export type InvestorCompanyRecommendation = {
	rank: number;
	company: Company;
	why: string;
	score?: number;
};

export type NavigatorPlanKind = "FOUNDER" | "INVESTOR";

export type NavigatorPlan = {
	id: string;
	userId: string;
	kind: NavigatorPlanKind;
	title?: string | null;
	input: unknown;
	result: unknown;
	createdAt: string;
	updatedAt: string;
};

export type Paginated<T> = {
	items: T[];
	total: number;
	limit: number;
	offset: number;
};

export type ResourceTaxonomy = {
	communities: string[];
	industries: string[];
	locations: string[];
	topics: string[];
};

export type ResourceImportPreviewRow = {
	rowNumber: number;
	action: "create" | "update" | "duplicate" | "invalid";
	name?: string;
	existingResourceName?: string;
	errors: string[];
};

export type ResourceImportPreview = {
	importSessionId: string;
	totalRows: number;
	validRows: number;
	invalidRows: number;
	newResources: number;
	updatedResources: number;
	duplicateRows: number;
	newTaxonomyValues: ResourceTaxonomy;
	errors: string[];
	rows: ResourceImportPreviewRow[];
};

export type ResourceImportCommitResult = {
	imported: number;
	created: number;
	updated: number;
	errors: string[];
	publishedImmediately: boolean;
};

type ApiResponse<T> = {
	data?: T;
	error?: { message?: string };
};

export async function parseApiResponse<T>(response: Response): Promise<T> {
	const payload = (await response.json()) as ApiResponse<T>;
	if (!response.ok || payload.error) {
		throw new Error(payload.error?.message ?? "Request failed");
	}
	if (payload.data === undefined) throw new Error("API returned no data");
	return payload.data;
}

export async function apiClient<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const unsafe = options.method && options.method !== "GET";
	const csrfToken = unsafe ? await getCsrfToken() : null;
	const response = await fetch(toApiUrl(path), {
		credentials: "include",
		...options,
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
			...options.headers,
		},
	});
	return parseApiResponse<T>(response);
}

export function compactDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}
