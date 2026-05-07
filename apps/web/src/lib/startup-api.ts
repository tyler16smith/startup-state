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
	sectors: string[];
	goals: string[];
	regions: string[];
	businessTypes: string[];
	eligibilityTags: string[];
	city?: string | null;
	county?: string | null;
	state?: string | null;
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
	};
};

export type Paginated<T> = {
	items: T[];
	total: number;
	limit: number;
	offset: number;
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
