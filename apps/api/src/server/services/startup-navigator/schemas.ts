import { z } from "zod";

export const resourceStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export const companyStatusSchema = z.enum([
	"DRAFT",
	"PENDING_REVIEW",
	"PUBLISHED",
	"ARCHIVED",
]);
export const hiringStatusSchema = z.enum([
	"NOT_HIRING",
	"HIRING",
	"ACTIVELY_HIRING",
	"UNKNOWN",
]);

export function asArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.flatMap((item) => asArray(item))
			.map((item) => item.trim())
			.filter(Boolean);
	}
	if (typeof value !== "string") return [];
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

const arrayInput = z.preprocess(asArray, z.array(z.string()).default([]));
const optionalNumber = z.preprocess((value) => {
	if (value === "" || value === null || value === undefined) return undefined;
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : value;
}, z.number().optional());

export const paginationSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(24),
	offset: z.coerce.number().int().min(0).default(0),
});

export const resourceQuerySchema = paginationSchema.extend({
	q: z.string().optional(),
	stage: z.string().optional(),
	sector: z.string().optional(),
	goal: z.string().optional(),
	region: z.string().optional(),
	businessType: z.string().optional(),
	status: resourceStatusSchema.optional(),
	sort: z.enum(["relevance", "name", "recent"]).default("recent"),
});

export const resourceInputSchema = z.object({
	name: z.string().min(2).max(180),
	slug: z.string().min(2).max(220).optional(),
	description: z.string().min(10),
	shortDescription: z.string().max(280).optional().nullable(),
	websiteUrl: z.string().url().optional().nullable().or(z.literal("")),
	contactName: z.string().optional().nullable(),
	contactEmail: z.string().email().optional().nullable().or(z.literal("")),
	contactPhone: z.string().optional().nullable(),
	category: z.string().optional().nullable(),
	subcategory: z.string().optional().nullable(),
	status: resourceStatusSchema.default("PUBLISHED"),
	stages: arrayInput,
	sectors: arrayInput,
	goals: arrayInput,
	regions: arrayInput,
	businessTypes: arrayInput,
	eligibilityTags: arrayInput,
	city: z.string().optional().nullable(),
	county: z.string().optional().nullable(),
	state: z.string().optional().nullable(),
	source: z.string().optional().nullable(),
	sourceId: z.string().optional().nullable(),
});

export const founderProfileInputSchema = z.object({
	stage: z.string().optional(),
	city: z.string().optional(),
	county: z.string().optional(),
	region: z.string().optional(),
	sectors: arrayInput,
	goals: arrayInput,
	businessTypes: arrayInput,
	fundingNeeds: arrayInput,
	hiringStatus: z.string().optional(),
	keywords: z.string().optional(),
});

export const savedResourceInputSchema = z.object({
	resourceId: z.string().min(1),
});

export const companyQuerySchema = paginationSchema.extend({
	q: z.string().optional(),
	sector: z.string().optional(),
	stage: z.string().optional(),
	hiringStatus: hiringStatusSchema.optional(),
	employeeMin: optionalNumber,
	employeeMax: optionalNumber,
	city: z.string().optional(),
	county: z.string().optional(),
	region: z.string().optional(),
	status: companyStatusSchema.optional(),
	sort: z.enum(["name", "recent"]).default("recent"),
});

export const companyPhotoInputSchema = z.object({
	url: z.string().url(),
	altText: z.string().optional().nullable(),
	sortOrder: z.coerce.number().int().default(0),
});

export const companyInputSchema = z.object({
	name: z.string().min(2).max(180),
	slug: z.string().min(2).max(220).optional(),
	websiteUrl: z.string().url().optional().nullable().or(z.literal("")),
	linkedinUrl: z.string().url().optional().nullable().or(z.literal("")),
	description: z.string().optional().nullable(),
	sector: z.string().optional().nullable(),
	stage: z.string().optional().nullable(),
	employees: optionalNumber,
	employeeRange: z.string().optional().nullable(),
	yearFounded: optionalNumber,
	address: z.string().optional().nullable(),
	city: z.string().optional().nullable(),
	county: z.string().optional().nullable(),
	state: z.string().optional().nullable(),
	postalCode: z.string().optional().nullable(),
	latitude: optionalNumber,
	longitude: optionalNumber,
	hiringStatus: hiringStatusSchema.default("UNKNOWN"),
	jobPostingsUrl: z.string().url().optional().nullable().or(z.literal("")),
	status: companyStatusSchema.default("PUBLISHED"),
	source: z.string().optional().nullable(),
	sourceId: z.string().optional().nullable(),
	photos: z.array(companyPhotoInputSchema).default([]),
});

export const claimCompanyInputSchema = z.object({
	companyId: z.string().min(1),
	workEmail: z.string().email(),
	explanation: z.string().max(1000).optional(),
});

export const idInputSchema = z.object({
	id: z.string().min(1).optional(),
	resourceId: z.string().min(1).optional(),
	companyId: z.string().min(1).optional(),
	claimId: z.string().min(1).optional(),
	slug: z.string().min(1).optional(),
});

export const csvImportSchema = z.object({
	csv: z.string().min(1),
});
