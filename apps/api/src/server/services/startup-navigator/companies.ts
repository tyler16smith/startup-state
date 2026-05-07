import Papa from "papaparse";
import { createApiError } from "~/server/api-context";
import type { Prisma, PrismaClient } from "../../../../generated/prisma";
import {
	asArray,
	claimCompanyInputSchema,
	companyInputSchema,
	companyQuerySchema,
	csvImportSchema,
} from "./schemas";
import { createUniqueSlug } from "./slug";

type Db = PrismaClient;

function cleanOptional(value: string | null | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

function containsInsensitive(value: string): Prisma.StringFilter {
	return { contains: value, mode: "insensitive" };
}

function buildCompanyWhere(
	input: unknown,
	options: { admin?: boolean } = {},
): Prisma.CompanyWhereInput {
	const query = companyQuerySchema.parse(input);
	const where: Prisma.CompanyWhereInput = {};

	if (query.status) {
		where.status = query.status;
	} else if (!options.admin) {
		where.status = "PUBLISHED";
	}

	if (query.q) {
		where.OR = [
			{ name: containsInsensitive(query.q) },
			{ description: containsInsensitive(query.q) },
			{ sector: containsInsensitive(query.q) },
			{ city: containsInsensitive(query.q) },
			{ county: containsInsensitive(query.q) },
		];
	}

	if (query.sector)
		where.sector = { equals: query.sector, mode: "insensitive" };
	if (query.stage) where.stage = { equals: query.stage, mode: "insensitive" };
	if (query.hiringStatus) where.hiringStatus = query.hiringStatus;
	if (query.city) where.city = { equals: query.city, mode: "insensitive" };
	if (query.county)
		where.county = { equals: query.county, mode: "insensitive" };
	if (query.employeeMin || query.employeeMax) {
		where.employees = {
			...(query.employeeMin ? { gte: query.employeeMin } : {}),
			...(query.employeeMax ? { lte: query.employeeMax } : {}),
		};
	}

	return where;
}

export async function searchCompanies(
	db: Db,
	input: unknown,
	options: { admin?: boolean } = {},
) {
	const query = companyQuerySchema.parse(input);
	const where = buildCompanyWhere(query, options);
	const orderBy: Prisma.CompanyOrderByWithRelationInput =
		query.sort === "name" ? { name: "asc" } : { updatedAt: "desc" };
	const [items, total] = await Promise.all([
		db.company.findMany({
			where,
			include: { photos: { orderBy: { sortOrder: "asc" }, take: 1 } },
			orderBy,
			take: query.limit,
			skip: query.offset,
		}),
		db.company.count({ where }),
	]);

	return { items, total, limit: query.limit, offset: query.offset };
}

export async function getCompanyById(
	db: Db,
	input: { id?: string; slug?: string },
	options: { admin?: boolean } = {},
) {
	if (!input.id && !input.slug)
		throw createApiError("Company id required", 400);
	const company = await db.company.findFirst({
		where: {
			...(input.id ? { id: input.id } : { slug: input.slug }),
			...(options.admin ? {} : { status: "PUBLISHED" as const }),
		},
		include: {
			photos: { orderBy: { sortOrder: "asc" } },
			owners: true,
			claims: { orderBy: { createdAt: "desc" }, take: 5 },
		},
	});

	if (!company) throw createApiError("Company not found", 404);

	const related = await db.company.findMany({
		where: {
			id: { not: company.id },
			status: "PUBLISHED",
			OR: [
				...(company.sector ? [{ sector: company.sector }] : []),
				...(company.city ? [{ city: company.city }] : []),
				...(company.county ? [{ county: company.county }] : []),
			],
		},
		include: { photos: { orderBy: { sortOrder: "asc" }, take: 1 } },
		take: 3,
		orderBy: { updatedAt: "desc" },
	});

	return { ...company, related };
}

function photoData(
	photos: Array<{ url: string; altText?: string | null; sortOrder: number }>,
) {
	return photos.map((photo, index) => ({
		url: photo.url,
		altText: photo.altText,
		sortOrder: photo.sortOrder ?? index,
	}));
}

export async function createCompany(
	db: Db,
	input: unknown,
	options: { submittedByUserId?: string; admin?: boolean } = {},
) {
	const data = companyInputSchema.parse(input);
	const slug = await createUniqueSlug(
		data.name,
		async (candidate) =>
			Boolean(await db.company.findUnique({ where: { slug: candidate } })),
		data.slug,
	);
	const status = options.admin ? data.status : "PENDING_REVIEW";

	const company = await db.company.create({
		data: {
			...data,
			slug,
			status,
			websiteUrl: cleanOptional(data.websiteUrl),
			linkedinUrl: cleanOptional(data.linkedinUrl),
			jobPostingsUrl: cleanOptional(data.jobPostingsUrl),
			state: cleanOptional(data.state) ?? "UT",
			photos: { create: photoData(data.photos) },
		},
		include: { photos: true },
	});

	if (options.submittedByUserId) {
		await db.user.update({
			where: { id: options.submittedByUserId },
			data: { role: "PENDING_COMPANY_OWNER" },
		});
	}

	return company;
}

export async function updateCompany(db: Db, companyId: string, input: unknown) {
	const data = companyInputSchema.partial().parse(input);
	const { photos, ...companyData } = data;
	const current = await db.company.findUnique({ where: { id: companyId } });
	if (!current) throw createApiError("Company not found", 404);

	const slug =
		data.name || data.slug
			? await createUniqueSlug(
					data.name ?? current.name,
					async (candidate) => {
						const found = await db.company.findUnique({
							where: { slug: candidate },
						});
						return Boolean(found && found.id !== companyId);
					},
					data.slug ?? current.slug,
				)
			: undefined;

	return db.$transaction(async (tx) => {
		if (photos) {
			await tx.companyPhoto.deleteMany({ where: { companyId } });
		}

		return tx.company.update({
			where: { id: companyId },
			data: {
				...companyData,
				...(slug ? { slug } : {}),
				...(companyData.websiteUrl !== undefined
					? { websiteUrl: cleanOptional(companyData.websiteUrl) }
					: {}),
				...(companyData.linkedinUrl !== undefined
					? { linkedinUrl: cleanOptional(companyData.linkedinUrl) }
					: {}),
				...(companyData.jobPostingsUrl !== undefined
					? { jobPostingsUrl: cleanOptional(companyData.jobPostingsUrl) }
					: {}),
				...(photos ? { photos: { create: photoData(photos) } } : {}),
			},
			include: { photos: true },
		});
	});
}

export async function archiveCompany(db: Db, companyId: string) {
	return db.company.update({
		where: { id: companyId },
		data: { status: "ARCHIVED" },
	});
}

function getDomain(value?: string | null) {
	if (!value) return null;
	try {
		return new URL(
			value.startsWith("http") ? value : `https://${value}`,
		).hostname
			.replace(/^www\./, "")
			.toLowerCase();
	} catch {
		return null;
	}
}

export async function createCompanyClaim(
	db: Db,
	userId: string,
	input: unknown,
) {
	const data = claimCompanyInputSchema.parse(input);
	const company = await db.company.findUnique({
		where: { id: data.companyId },
	});
	if (!company) throw createApiError("Company not found", 404);

	const emailDomain = data.workEmail.split("@").at(1)?.toLowerCase() ?? "";
	const websiteDomain = getDomain(company.websiteUrl);
	const domainMatches = Boolean(websiteDomain && emailDomain === websiteDomain);

	const claim = await db.companyClaim.create({
		data: { ...data, userId, domainMatches },
		include: {
			company: true,
			user: { select: { id: true, email: true, name: true } },
		},
	});

	await db.user.update({
		where: { id: userId },
		data: { role: "PENDING_COMPANY_OWNER" },
	});

	return claim;
}

export async function listCompanyClaims(db: Db, input: unknown) {
	const query = companyQuerySchema.partial().parse(input);
	return db.companyClaim.findMany({
		where: query.status ? { status: query.status as never } : undefined,
		include: {
			company: true,
			user: { select: { id: true, email: true, name: true } },
		},
		orderBy: { createdAt: "desc" },
		take: 100,
	});
}

export async function approveCompanyClaim(
	db: Db,
	claimId: string,
	reviewerId: string,
) {
	const claim = await db.companyClaim.findUnique({ where: { id: claimId } });
	if (!claim) throw createApiError("Claim not found", 404);

	return db.$transaction(async (tx) => {
		await tx.companyOwner.upsert({
			where: {
				companyId_userId: { companyId: claim.companyId, userId: claim.userId },
			},
			create: { companyId: claim.companyId, userId: claim.userId },
			update: {},
		});

		await tx.user.update({
			where: { id: claim.userId },
			data: { role: "COMPANY_OWNER" },
		});

		return tx.companyClaim.update({
			where: { id: claimId },
			data: {
				status: "APPROVED",
				reviewedAt: new Date(),
				reviewedById: reviewerId,
			},
		});
	});
}

export async function rejectCompanyClaim(
	db: Db,
	claimId: string,
	reviewerId: string,
) {
	return db.companyClaim.update({
		where: { id: claimId },
		data: {
			status: "REJECTED",
			reviewedAt: new Date(),
			reviewedById: reviewerId,
		},
	});
}

export async function getAdminSummary(db: Db) {
	const [
		resourceCount,
		companyCount,
		pendingClaims,
		pendingCompanies,
		resources,
		companies,
	] = await Promise.all([
		db.resource.count({ where: { status: { not: "ARCHIVED" } } }),
		db.company.count({ where: { status: { not: "ARCHIVED" } } }),
		db.companyClaim.count({ where: { status: "PENDING" } }),
		db.company.count({ where: { status: "PENDING_REVIEW" } }),
		db.resource.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
		db.company.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
	]);

	return {
		resourceCount,
		companyCount,
		pendingClaims,
		pendingCompanies,
		resources,
		companies,
	};
}

function pickCsvValue(row: Record<string, unknown>, names: string[]) {
	for (const name of names) {
		const value = row[name] ?? row[name.toLowerCase()];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return undefined;
}

export async function importCompaniesFromCsv(db: Db, input: unknown) {
	const { csv } = csvImportSchema.parse(input);
	const parsed = Papa.parse<Record<string, unknown>>(csv, {
		header: true,
		skipEmptyLines: true,
	});

	let imported = 0;
	const errors: string[] = [];

	for (const [index, row] of parsed.data.entries()) {
		try {
			const photos = asArray(pickCsvValue(row, ["photos", "photo urls"])).map(
				(url, sortOrder) => ({ url, sortOrder }),
			);
			await createCompany(
				db,
				{
					name: pickCsvValue(row, ["name", "Name"]),
					websiteUrl: pickCsvValue(row, ["website", "websiteUrl", "url"]),
					employees: pickCsvValue(row, ["employees"]),
					employeeRange: pickCsvValue(row, ["employee range", "employeeRange"]),
					sector: pickCsvValue(row, ["sector"]),
					stage: pickCsvValue(row, ["stage"]),
					yearFounded: pickCsvValue(row, ["year founded", "yearFounded"]),
					linkedinUrl: pickCsvValue(row, ["linkedin", "linkedinUrl"]),
					description: pickCsvValue(row, ["description"]),
					address: pickCsvValue(row, ["address"]),
					city: pickCsvValue(row, ["city"]),
					county: pickCsvValue(row, ["county"]),
					state: pickCsvValue(row, ["state"]),
					postalCode: pickCsvValue(row, ["postal code", "postalCode"]),
					latitude: pickCsvValue(row, ["latitude"]),
					longitude: pickCsvValue(row, ["longitude"]),
					hiringStatus:
						pickCsvValue(row, ["hiring status", "hiringStatus"]) ?? "UNKNOWN",
					jobPostingsUrl: pickCsvValue(row, ["job postings", "jobPostingsUrl"]),
					photos,
				},
				{ admin: true },
			);
			imported += 1;
		} catch (error) {
			errors.push(
				`Row ${index + 2}: ${error instanceof Error ? error.message : "Invalid row"}`,
			);
		}
	}

	return { imported, errors };
}
