import Papa from "papaparse";
import { z } from "zod";
import { createApiError } from "~/server/api-context";
import type { Prisma, PrismaClient } from "../../../../generated/prisma";
import {
	asArray,
	claimCompanyInputSchema,
	companyInputSchema,
	companyQuerySchema,
	csvImportSchema,
} from "./schemas";
import { createUniqueSlug, slugify } from "./slug";

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
	const rawInput =
		typeof input === "object" && input !== null
			? (input as Record<string, unknown>)
			: {};
	const submittedWorkEmail =
		typeof rawInput.workEmail === "string" ? rawInput.workEmail.trim() : "";
	const data = companyInputSchema.parse(input);
	const slug = await createUniqueSlug(
		data.name,
		async (candidate) =>
			Boolean(await db.company.findUnique({ where: { slug: candidate } })),
		data.slug,
	);
	const status = options.admin ? data.status : "PENDING_REVIEW";

	const company = await db.$transaction(async (tx) => {
		const created = await tx.company.create({
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
			const submitter = await tx.user.findUnique({
				where: { id: options.submittedByUserId },
				select: { email: true },
			});
			const workEmailCandidate = submittedWorkEmail || submitter?.email || "";
			const workEmail = z.string().email().safeParse(workEmailCandidate);
			if (!workEmail.success) {
				throw createApiError("Valid work email required", 400);
			}

			const emailDomain = workEmail.data.split("@").at(1)?.toLowerCase() ?? "";
			const websiteDomain = getDomain(created.websiteUrl);
			await tx.companyClaim.create({
				data: {
					companyId: created.id,
					userId: options.submittedByUserId,
					workEmail: workEmail.data,
					explanation: "Created this company listing.",
					domainMatches: domainsMatch(emailDomain, websiteDomain),
				},
			});

			await tx.user.update({
				where: { id: options.submittedByUserId },
				data: { role: "PENDING_COMPANY_OWNER" },
			});
		}

		return created;
	});

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

function domainsMatch(emailDomain: string, websiteDomain: string | null) {
	if (!websiteDomain) return false;
	return (
		emailDomain === websiteDomain || emailDomain.endsWith(`.${websiteDomain}`)
	);
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
	const domainMatches = domainsMatch(emailDomain, websiteDomain);

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

function normalizeCsvRow(
	row: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]),
	);
}

function pickCsvValue(row: Record<string, unknown>, names: string[]) {
	const normalized = normalizeCsvRow(row);
	for (const name of names) {
		const value = normalized[name.trim().toLowerCase()];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return undefined;
}

function hasCsvRowValue(row: Record<string, unknown>) {
	return Object.values(row).some((value) => {
		if (typeof value === "string") return Boolean(value.trim());
		return value !== null && value !== undefined;
	});
}

function normalizeUrl(value: string | undefined): string | undefined {
	if (!value) return undefined;
	if (/^https?:\/\//i.test(value)) return value;
	return `https://${value}`;
}

function parseRowToCompanyData(row: Record<string, unknown>) {
	const photos = asArray(pickCsvValue(row, ["photos", "photo urls"])).map(
		(url, sortOrder) => ({ url, sortOrder }),
	);
	return companyInputSchema.parse({
		name: pickCsvValue(row, ["name", "Name", "Startup Name"]),
		websiteUrl: normalizeUrl(
			pickCsvValue(row, ["website", "websiteUrl", "url", "Website"]),
		),
		employees: pickCsvValue(row, ["employees"]),
		employeeRange: pickCsvValue(row, [
			"employee range",
			"employeeRange",
			"# of Employees",
			"Number of Employees",
		]),
		sector: pickCsvValue(row, ["sector", "Section"]),
		stage: pickCsvValue(row, ["stage", "Stage"]),
		yearFounded: pickCsvValue(row, ["year founded", "yearFounded"]),
		linkedinUrl: normalizeUrl(
			pickCsvValue(row, [
				"linkedin",
				"linkedinUrl",
				"LinkedIn Link",
				"LinkedIn URL",
			]),
		),
		description: pickCsvValue(row, [
			"description",
			"Description of startup",
			"Description",
		]),
		address: pickCsvValue(row, ["address", "Full Address"]),
		city: pickCsvValue(row, ["city"]),
		county: pickCsvValue(row, ["county"]),
		state: pickCsvValue(row, ["state"]),
		postalCode: pickCsvValue(row, ["postal code", "postalCode"]),
		latitude: pickCsvValue(row, ["latitude"]),
		longitude: pickCsvValue(row, ["longitude"]),
		hiringStatus:
			pickCsvValue(row, ["hiring status", "hiringStatus"]) ?? "UNKNOWN",
		jobPostingsUrl: normalizeUrl(
			pickCsvValue(row, ["job postings", "jobPostingsUrl"]),
		),
		photos,
	});
}

export async function importCompaniesFromCsv(db: Db, input: unknown) {
	const { csv } = csvImportSchema.parse(input);
	const parsed = Papa.parse<Record<string, unknown>>(csv, {
		header: true,
		skipEmptyLines: "greedy",
	});

	const errors: string[] = [];
	type ParsedRow = ReturnType<typeof parseRowToCompanyData>;
	const validRows: ParsedRow[] = [];

	for (const [index, row] of parsed.data.entries()) {
		if (!hasCsvRowValue(row)) continue;

		try {
			validRows.push(parseRowToCompanyData(row));
		} catch (error) {
			errors.push(
				`Row ${index + 2}: ${error instanceof Error ? error.message : "Invalid row"}`,
			);
		}
	}

	if (validRows.length === 0) return { imported: 0, errors };

	// Split creates vs updates using websiteUrl as the unique key
	const websiteUrls = validRows
		.map((r) => r.websiteUrl)
		.filter((u): u is string => Boolean(u));

	const existing =
		websiteUrls.length > 0
			? await db.company.findMany({
					where: { websiteUrl: { in: websiteUrls } },
					select: { id: true, websiteUrl: true },
				})
			: [];

	const existingByUrl = new Map(
		existing.flatMap((company) =>
			company.websiteUrl ? [[company.websiteUrl, company.id]] : [],
		),
	);

	const toCreate = validRows.filter(
		(r) => !r.websiteUrl || !existingByUrl.has(r.websiteUrl),
	);
	const toUpdate = validRows.flatMap((data) => {
		if (!data.websiteUrl) return [];
		const id = existingByUrl.get(data.websiteUrl);
		return id ? [{ data, id }] : [];
	});

	// Generate slugs for all creates in-memory to avoid N+1 DB checks
	const baseSlugCandidates = toCreate.map((r) => slugify(r.name));
	const dbSlugsResult = await db.company.findMany({
		where: { slug: { in: baseSlugCandidates } },
		select: { slug: true },
	});
	const usedSlugs = new Set(dbSlugsResult.map((c) => c.slug));

	const createData = toCreate.map((data) => {
		const { photos: _photos, ...companyFields } = data;
		const base = slugify(data.name);
		let slug = base;
		let suffix = 2;
		while (usedSlugs.has(slug)) {
			slug = `${base}-${suffix++}`;
		}
		usedSlugs.add(slug);
		return {
			...companyFields,
			slug,
			state: cleanOptional(companyFields.state) ?? "UT",
			websiteUrl: cleanOptional(companyFields.websiteUrl),
			linkedinUrl: cleanOptional(companyFields.linkedinUrl),
			jobPostingsUrl: cleanOptional(companyFields.jobPostingsUrl),
			status: "PUBLISHED" as const,
		};
	});

	if (createData.length > 0) {
		await db.company.createMany({ data: createData, skipDuplicates: true });
	}

	if (toUpdate.length > 0) {
		await Promise.all(
			toUpdate.map(({ data, id }) => {
				const { photos: _photos, ...companyFields } = data;
				return db.company.update({
					where: { id },
					data: {
						...companyFields,
						websiteUrl: cleanOptional(companyFields.websiteUrl),
						linkedinUrl: cleanOptional(companyFields.linkedinUrl),
						jobPostingsUrl: cleanOptional(companyFields.jobPostingsUrl),
					},
				});
			}),
		);
	}

	return { imported: validRows.length, errors };
}
