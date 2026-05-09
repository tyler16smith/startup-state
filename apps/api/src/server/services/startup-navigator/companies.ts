import Papa from "papaparse";
import { z } from "zod";
import { sendCompanyClaimVerificationEmail } from "~/lib/email/send-company-claim-verification-email";
import { logger } from "~/lib/logger";
import { createApiError } from "~/server/api-context";
import {
	generateClaimVerificationTokenPair,
	hashClaimVerificationToken,
} from "~/server/lib/claim-verification-token";
import type {
	ClaimStatus,
	Prisma,
	PrismaClient,
} from "../../../../generated/prisma";
import { enrichCompanyLocations } from "./geocoding";
import {
	asArray,
	claimCompanyInputSchema,
	claimIdInputSchema,
	claimStatusSchema,
	claimVerificationInputSchema,
	companyInputSchema,
	companyQuerySchema,
	csvImportSchema,
	reviewCompanySubmissionInputSchema,
} from "./schemas";
import { createUniqueSlug, slugify } from "./slug";
import { getWebsiteDomain } from "./website-domain";

type Db = PrismaClient;
type MyCompanyRelationship = "owner" | "submitted" | "claim";
type MyCompanyCompany = Prisma.CompanyGetPayload<{ include: { photos: true } }>;
type MyCompanyEntry = {
	company: MyCompanyCompany;
	relationship: MyCompanyRelationship;
	claimId?: string;
	claimStatus?: ClaimStatus;
	canEdit: boolean;
	submittedAt?: Date;
	ownedAt?: Date;
	updatedAt: Date;
};

const PUBLIC_COMPANY_SUBMISSION_SOURCE = "public_company_submission";
const CLAIM_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;
const CLAIM_VERIFICATION_RESEND_COOLDOWN_MS = 60_000;
const PERSONAL_EMAIL_DOMAINS = new Set([
	"gmail.com",
	"yahoo.com",
	"outlook.com",
	"hotmail.com",
	"icloud.com",
	"proton.me",
]);
const MULTI_PART_PUBLIC_SUFFIXES = new Set([
	"co.uk",
	"com.au",
	"com.br",
	"com.mx",
	"com.sg",
	"co.in",
	"co.jp",
	"co.nz",
]);

function cleanOptional(value: string | null | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

function getClaimBaseUrl(): string {
	const baseUrl = process.env.APP_BASE_URL?.trim();
	if (!baseUrl) throw createApiError("APP_BASE_URL is not configured", 500);
	return baseUrl.replace(/\/$/, "");
}

function getRootDomain(domain: string): string {
	const parts = domain
		.toLowerCase()
		.replace(/\.$/, "")
		.split(".")
		.filter(Boolean);
	if (parts.length <= 2) return parts.join(".");
	const suffix = parts.slice(-2).join(".");
	if (MULTI_PART_PUBLIC_SUFFIXES.has(suffix)) {
		return parts.slice(-3).join(".");
	}
	return parts.slice(-2).join(".");
}

function getEmailRootDomain(email: string): string {
	const emailDomain = email.split("@").at(1)?.toLowerCase() ?? "";
	return getRootDomain(emailDomain);
}

function validateClaimEmailDomain(email: string, websiteUrl?: string | null) {
	const emailRootDomain = getEmailRootDomain(email);
	if (PERSONAL_EMAIL_DOMAINS.has(emailRootDomain)) {
		throw createApiError(
			"Use your company email address to claim a listing",
			400,
		);
	}

	const websiteDomain = getWebsiteDomain(websiteUrl);
	if (!websiteDomain) {
		throw createApiError(
			"Company website is required before this listing can be claimed",
			400,
		);
	}

	const websiteRootDomain = getRootDomain(websiteDomain);
	if (emailRootDomain !== websiteRootDomain) {
		throw createApiError(
			"Work email domain must match the company website domain",
			400,
		);
	}

	return { emailRootDomain, websiteRootDomain };
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
	} else {
		where.status = { not: "ARCHIVED" };
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
	const [enrichedData] = await enrichCompanyLocations([data]);
	const companyData = enrichedData ?? data;
	const slug = await createUniqueSlug(
		companyData.name,
		async (candidate) =>
			Boolean(await db.company.findUnique({ where: { slug: candidate } })),
		companyData.slug,
	);
	const status = options.admin ? "PUBLISHED" : "PENDING_REVIEW";

	const company = await db.$transaction(async (tx) => {
		const created = await tx.company.create({
			data: {
				...companyData,
				slug,
				status,
				source: options.admin
					? companyData.source
					: PUBLIC_COMPANY_SUBMISSION_SOURCE,
				websiteUrl: cleanOptional(companyData.websiteUrl),
				linkedinUrl: cleanOptional(companyData.linkedinUrl),
				jobPostingsUrl: cleanOptional(companyData.jobPostingsUrl),
				state: cleanOptional(companyData.state) ?? "UT",
				photos: { create: photoData(companyData.photos) },
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
			const websiteDomain = getWebsiteDomain(created.websiteUrl);
			await tx.companyClaim.create({
				data: {
					companyId: created.id,
					userId: options.submittedByUserId,
					workEmail: workEmail.data,
					explanation: "Created this company listing.",
					domainMatches: domainsMatch(emailDomain, websiteDomain),
					status: "pending_review",
				},
			});

			await tx.user.updateMany({
				where: { id: options.submittedByUserId, role: "USER" },
				data: { role: "PENDING_COMPANY_OWNER" },
			});
		}

		return created;
	});

	return company;
}

function publicCompanySubmissionWhere(
	status: "PENDING_REVIEW" | "DRAFT" = "PENDING_REVIEW",
): Prisma.CompanyWhereInput {
	return {
		status,
		OR: [
			{ source: PUBLIC_COMPANY_SUBMISSION_SOURCE },
			{ claims: { some: {} } },
		],
	};
}

export async function listCompanySubmissions(db: Db) {
	return db.company.findMany({
		where: publicCompanySubmissionWhere(),
		include: {
			photos: { orderBy: { sortOrder: "asc" } },
			claims: {
				orderBy: { createdAt: "asc" },
				include: { user: { select: { id: true, email: true, name: true } } },
			},
		},
		orderBy: { createdAt: "asc" },
	});
}

export async function reviewCompanySubmission(
	db: Db,
	input: unknown,
	reviewerId: string,
) {
	const data = reviewCompanySubmissionInputSchema.parse(input);

	return db.$transaction(async (tx) => {
		const company = await tx.company.findFirst({
			where: { id: data.companyId, ...publicCompanySubmissionWhere() },
			include: { claims: true },
		});

		if (!company) throw createApiError("Company submission not found", 404);

		if (data.action === "hold") {
			return tx.company.update({
				where: { id: company.id },
				data: { status: "DRAFT" },
				include: { photos: true },
			});
		}

		if (data.action === "reject") {
			await tx.companyClaim.updateMany({
				where: { companyId: company.id, status: "pending_review" },
				data: {
					status: "rejected",
					reviewedAt: new Date(),
					reviewedById: reviewerId,
				},
			});

			return tx.company.update({
				where: { id: company.id },
				data: { status: "ARCHIVED" },
				include: { photos: true },
			});
		}

		const pendingClaims = company.claims.filter(
			(claim) => claim.status === "pending_review",
		);
		for (const claim of pendingClaims) {
			await tx.companyOwner.upsert({
				where: {
					companyId_userId: {
						companyId: company.id,
						userId: claim.userId,
					},
				},
				create: { companyId: company.id, userId: claim.userId },
				update: {},
			});

			await tx.user.updateMany({
				where: { id: claim.userId, role: { not: "ADMIN" } },
				data: { role: "COMPANY_OWNER" },
			});
		}

		await tx.companyClaim.updateMany({
			where: { companyId: company.id, status: "pending_review" },
			data: {
				status: "approved",
				reviewedAt: new Date(),
				reviewedById: reviewerId,
			},
		});

		return tx.company.update({
			where: { id: company.id },
			data: { status: "PUBLISHED" },
			include: { photos: true },
		});
	});
}

export async function updateCompany(db: Db, companyId: string, input: unknown) {
	const data = companyInputSchema.partial().parse(input);
	const { photos, ...companyData } = data;
	const current = await db.company.findUnique({ where: { id: companyId } });
	if (!current) throw createApiError("Company not found", 404);
	const [enrichedLocation] = await enrichCompanyLocations([
		{ ...current, ...companyData },
	]);
	const locationData = enrichedLocation
		? {
				address: enrichedLocation.address,
				city: enrichedLocation.city,
				county: enrichedLocation.county,
				state: enrichedLocation.state,
				postalCode: enrichedLocation.postalCode,
				latitude: enrichedLocation.latitude,
				longitude: enrichedLocation.longitude,
				locationPrecision: enrichedLocation.locationPrecision,
				geocodeProvider: enrichedLocation.geocodeProvider,
			}
		: {};

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
				...locationData,
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

export async function listMyCompanies(db: Db, userId: string) {
	const [claims, ownerships] = await Promise.all([
		db.companyClaim.findMany({
			where: { userId },
			include: {
				company: { include: { photos: { orderBy: { sortOrder: "asc" } } } },
			},
			orderBy: { updatedAt: "desc" },
		}),
		db.companyOwner.findMany({
			where: { userId },
			include: {
				company: { include: { photos: { orderBy: { sortOrder: "asc" } } } },
			},
			orderBy: { createdAt: "desc" },
		}),
	]);

	const entries = new Map<string, MyCompanyEntry>();

	for (const claim of claims) {
		const relationship: MyCompanyRelationship =
			claim.company.source === PUBLIC_COMPANY_SUBMISSION_SOURCE
				? "submitted"
				: "claim";
		entries.set(claim.companyId, {
			company: claim.company,
			relationship,
			claimId: claim.id,
			claimStatus: claim.status,
			canEdit: false,
			submittedAt: claim.createdAt,
			updatedAt: claim.updatedAt,
		});
	}

	for (const ownership of ownerships) {
		const currentEntry = entries.get(ownership.companyId);
		entries.set(ownership.companyId, {
			...(currentEntry ?? {}),
			company: ownership.company,
			relationship: "owner",
			canEdit: true,
			ownedAt: ownership.createdAt,
			updatedAt: ownership.createdAt,
		});
	}

	return Array.from(entries.values()).sort((first, second) => {
		const firstDate = entryDate(first);
		const secondDate = entryDate(second);
		return secondDate.getTime() - firstDate.getTime();
	});
}

function entryDate(entry: MyCompanyEntry) {
	return entry.ownedAt ?? entry.updatedAt ?? entry.submittedAt ?? new Date(0);
}

export async function archiveCompany(db: Db, companyId: string) {
	return db.company.update({
		where: { id: companyId },
		data: { status: "ARCHIVED" },
	});
}

function domainsMatch(emailDomain: string, websiteDomain: string | null) {
	if (!websiteDomain) return false;
	return getRootDomain(emailDomain) === getRootDomain(websiteDomain);
}

async function sendVerificationForClaim(
	db: Db,
	claim: {
		id: string;
		companyId: string;
		workEmail: string;
		company: { name: string };
	},
	context: { operation: string; userId: string },
) {
	const { rawToken, tokenHash } = generateClaimVerificationTokenPair();
	const expiresAt = new Date(Date.now() + CLAIM_VERIFICATION_EXPIRY_MS);
	await db.companyClaim.update({
		where: { id: claim.id },
		data: {
			verificationTokenHash: tokenHash,
			verificationExpiresAt: expiresAt,
		},
	});

	const verificationUrl = `${getClaimBaseUrl()}/claims/${claim.id}/verify-email?token=${encodeURIComponent(rawToken)}`;

	try {
		await sendCompanyClaimVerificationEmail({
			to: claim.workEmail,
			companyName: claim.company.name,
			verificationUrl,
			expiresAt,
		});
	} catch (error) {
		logger.logError("Failed to send company claim verification email", error, {
			feature: "company_claims",
			operation: context.operation,
			userId: context.userId,
			claimId: claim.id,
			companyId: claim.companyId,
		});
		throw createApiError("Failed to send verification email", 500);
	}

	return db.companyClaim.update({
		where: { id: claim.id },
		data: { lastVerificationSentAt: new Date() },
		include: {
			company: true,
			user: { select: { id: true, email: true, name: true } },
		},
	});
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

	validateClaimEmailDomain(data.workEmail, company.websiteUrl);
	const emailDomain = data.workEmail.split("@").at(1)?.toLowerCase() ?? "";
	const websiteDomain = getWebsiteDomain(company.websiteUrl);
	const domainMatches = domainsMatch(emailDomain, websiteDomain);
	const existingClaim = await db.companyClaim.findFirst({
		where: {
			companyId: data.companyId,
			userId,
			status: {
				in: ["email_pending", "pending_review", "on_hold", "approved"],
			},
		},
		include: { company: true },
		orderBy: { createdAt: "desc" },
	});

	if (existingClaim?.status === "pending_review") {
		throw createApiError("Claim is already pending review", 409);
	}
	if (existingClaim?.status === "on_hold") {
		throw createApiError("Claim is on hold for admin review", 409);
	}
	if (existingClaim?.status === "approved") {
		throw createApiError("Claim has already been approved", 409);
	}

	const claim = existingClaim
		? await db.companyClaim.update({
				where: { id: existingClaim.id },
				data: {
					workEmail: data.workEmail,
					explanation: data.explanation,
					domainMatches,
					emailVerifiedAt: null,
				},
				include: { company: true },
			})
		: await db.companyClaim.create({
				data: {
					...data,
					userId,
					domainMatches,
					status: "email_pending",
				},
				include: { company: true },
			});

	return sendVerificationForClaim(db, claim, {
		operation: existingClaim ? "updateClaimEmail" : "createClaim",
		userId,
	});
}

export async function listCompanyClaims(db: Db, input: unknown) {
	const query = z
		.object({ status: claimStatusSchema.optional() })
		.partial()
		.parse(input);
	return db.companyClaim.findMany({
		where: query.status ? { status: query.status } : undefined,
		include: {
			company: true,
			user: { select: { id: true, email: true, name: true } },
		},
		orderBy: { createdAt: "desc" },
		take: 100,
	});
}

export async function getCompanyClaimForUser(
	db: Db,
	userId: string,
	input: unknown,
) {
	const data = claimIdInputSchema.parse(input);
	const claim = await db.companyClaim.findFirst({
		where: { id: data.claimId, userId },
		include: { company: true },
	});

	if (!claim) throw createApiError("Claim not found", 404);
	return claim;
}

export async function resendCompanyClaimVerification(
	db: Db,
	userId: string,
	input: unknown,
) {
	const data = claimIdInputSchema.parse(input);
	const claim = await db.companyClaim.findFirst({
		where: { id: data.claimId, userId },
		include: { company: true },
	});

	if (!claim) throw createApiError("Claim not found", 404);
	if (claim.status !== "email_pending") {
		throw createApiError("Only unverified claims can be resent", 409);
	}
	if (
		claim.lastVerificationSentAt &&
		Date.now() - claim.lastVerificationSentAt.getTime() <
			CLAIM_VERIFICATION_RESEND_COOLDOWN_MS
	) {
		throw createApiError("Please wait before requesting another email.", 429);
	}

	return sendVerificationForClaim(db, claim, {
		operation: "resendClaimVerification",
		userId,
	});
}

export async function verifyCompanyClaimEmail(db: Db, input: unknown) {
	const data = claimVerificationInputSchema.parse(input);
	const tokenHash = hashClaimVerificationToken(data.token);
	const claim = await db.companyClaim.findUnique({
		where: { id: data.claimId },
		include: { company: true },
	});

	if (!claim || claim.verificationTokenHash !== tokenHash) {
		throw createApiError("Invalid verification link", 400);
	}
	if (claim.status !== "email_pending") {
		throw createApiError("Claim email has already been verified", 409);
	}
	if (
		!claim.verificationExpiresAt ||
		claim.verificationExpiresAt <= new Date()
	) {
		throw createApiError("Verification link has expired", 410);
	}

	return db.$transaction(async (tx) => {
		const verifiedClaim = await tx.companyClaim.update({
			where: { id: claim.id },
			data: {
				emailVerifiedAt: new Date(),
				status: "pending_review",
				verificationTokenHash: null,
				verificationExpiresAt: null,
			},
			include: { company: true },
		});

		await tx.user.updateMany({
			where: { id: claim.userId, role: "USER" },
			data: { role: "PENDING_COMPANY_OWNER" },
		});

		return verifiedClaim;
	});
}

export async function approveCompanyClaim(
	db: Db,
	claimId: string,
	reviewerId: string,
) {
	const claim = await db.companyClaim.findUnique({ where: { id: claimId } });
	if (!claim) throw createApiError("Claim not found", 404);
	if (claim.status !== "pending_review" && claim.status !== "on_hold") {
		throw createApiError("Only verified claims can be approved", 409);
	}

	return db.$transaction(async (tx) => {
		await tx.companyOwner.upsert({
			where: {
				companyId_userId: { companyId: claim.companyId, userId: claim.userId },
			},
			create: { companyId: claim.companyId, userId: claim.userId },
			update: {},
		});

		await tx.user.updateMany({
			where: { id: claim.userId, role: { not: "ADMIN" } },
			data: { role: "COMPANY_OWNER" },
		});

		return tx.companyClaim.update({
			where: { id: claimId },
			data: {
				status: "approved",
				reviewedAt: new Date(),
				reviewedById: reviewerId,
			},
		});
	});
}

export async function holdCompanyClaim(
	db: Db,
	claimId: string,
	reviewerId: string,
) {
	const claim = await db.companyClaim.findUnique({ where: { id: claimId } });
	if (!claim) throw createApiError("Claim not found", 404);
	if (claim.status !== "pending_review") {
		throw createApiError("Only pending claims can be held", 409);
	}

	return db.companyClaim.update({
		where: { id: claimId },
		data: {
			status: "on_hold",
			reviewedAt: new Date(),
			reviewedById: reviewerId,
		},
	});
}

export async function rejectCompanyClaim(
	db: Db,
	claimId: string,
	reviewerId: string,
) {
	const claim = await db.companyClaim.findUnique({ where: { id: claimId } });
	if (!claim) throw createApiError("Claim not found", 404);
	if (claim.status !== "pending_review" && claim.status !== "on_hold") {
		throw createApiError("Only pending or held claims can be rejected", 409);
	}

	return db.companyClaim.update({
		where: { id: claimId },
		data: {
			status: "rejected",
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
		db.companyClaim.count({ where: { status: "pending_review" } }),
		db.company.count({ where: publicCompanySubmissionWhere() }),
		db.resource.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
		db.company.findMany({
			where: { status: { not: "ARCHIVED" } },
			orderBy: { updatedAt: "desc" },
			take: 5,
		}),
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
		address: pickCsvValue(row, ["address", "Address", "Full Address"]),
		city: pickCsvValue(row, ["city", "City"]),
		county: pickCsvValue(row, ["county", "County"]),
		state: pickCsvValue(row, ["state", "State"]),
		postalCode: pickCsvValue(row, [
			"postal code",
			"postalCode",
			"Postal Code",
			"Zip",
			"ZIP",
		]),
		latitude: pickCsvValue(row, ["latitude", "Latitude", "lat", "Lat"]),
		longitude: pickCsvValue(row, [
			"longitude",
			"Longitude",
			"lng",
			"Lng",
			"long",
			"Long",
		]),
		hiringStatus:
			pickCsvValue(row, ["hiring status", "hiringStatus"]) ?? "UNKNOWN",
		jobPostingsUrl: normalizeUrl(
			pickCsvValue(row, ["job postings", "jobPostingsUrl"]),
		),
		photos,
	});
}

type ParsedCompanyRow = ReturnType<typeof parseRowToCompanyData>;

function mergeDefinedCompanyData(
	current: ParsedCompanyRow,
	next: ParsedCompanyRow,
) {
	const merged = { ...current };
	for (const [key, value] of Object.entries(next)) {
		if (value !== undefined) {
			merged[key as keyof ParsedCompanyRow] = value as never;
		}
	}
	return merged;
}

function collapseCompanyRowsByWebsiteDomain(rows: ParsedCompanyRow[]) {
	const rowsByDomain = new Map<string, ParsedCompanyRow>();
	const rowsWithoutDomain: ParsedCompanyRow[] = [];

	for (const row of rows) {
		const domain = getWebsiteDomain(row.websiteUrl);
		if (!domain) {
			rowsWithoutDomain.push(row);
			continue;
		}

		const current = rowsByDomain.get(domain);
		rowsByDomain.set(
			domain,
			current ? mergeDefinedCompanyData(current, row) : row,
		);
	}

	return [...rowsByDomain.values(), ...rowsWithoutDomain];
}

async function findCompaniesByWebsiteDomain(db: Db, domains: string[]) {
	if (domains.length === 0) return new Map<string, string>();

	const existing = await db.company.findMany({
		where: {
			OR: domains.map((domain) => ({
				websiteUrl: { contains: domain, mode: "insensitive" },
			})),
		},
		select: { id: true, websiteUrl: true },
		orderBy: { updatedAt: "desc" },
	});
	const existingByDomain = new Map<string, string>();

	for (const company of existing) {
		const domain = getWebsiteDomain(company.websiteUrl);
		if (domain && domains.includes(domain) && !existingByDomain.has(domain)) {
			existingByDomain.set(domain, company.id);
		}
	}

	return existingByDomain;
}

function companyImportData(data: ParsedCompanyRow) {
	const { photos: _photos, ...companyFields } = data;
	return {
		...companyFields,
		state: cleanOptional(companyFields.state) ?? "UT",
		websiteUrl: cleanOptional(companyFields.websiteUrl),
		linkedinUrl: cleanOptional(companyFields.linkedinUrl),
		jobPostingsUrl: cleanOptional(companyFields.jobPostingsUrl),
		status: "PUBLISHED" as const,
	};
}

export async function importCompaniesFromCsv(db: Db, input: unknown) {
	const { csv } = csvImportSchema.parse(input);
	const parsed = Papa.parse<Record<string, unknown>>(csv, {
		header: true,
		skipEmptyLines: "greedy",
	});

	const errors: string[] = [];
	type ParsedRow = ReturnType<typeof parseRowToCompanyData>;
	let validRows: ParsedRow[] = [];

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
	validRows = collapseCompanyRowsByWebsiteDomain(
		await enrichCompanyLocations(validRows),
	);

	const websiteDomains = Array.from(
		new Set(
			validRows
				.map((row) => getWebsiteDomain(row.websiteUrl))
				.filter((domain): domain is string => Boolean(domain)),
		),
	);
	const existingByDomain = await findCompaniesByWebsiteDomain(
		db,
		websiteDomains,
	);

	const toCreate = validRows.filter((row) => {
		const domain = getWebsiteDomain(row.websiteUrl);
		return !domain || !existingByDomain.has(domain);
	});
	const toUpdate = validRows.flatMap((data) => {
		const domain = getWebsiteDomain(data.websiteUrl);
		const id = domain ? existingByDomain.get(domain) : undefined;
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
		const base = slugify(data.name);
		let slug = base;
		let suffix = 2;
		while (usedSlugs.has(slug)) {
			slug = `${base}-${suffix++}`;
		}
		usedSlugs.add(slug);
		return { ...companyImportData(data), slug };
	});

	if (createData.length > 0) {
		await db.company.createMany({ data: createData, skipDuplicates: true });
	}

	if (toUpdate.length > 0) {
		await Promise.all(
			toUpdate.map(({ data, id }) =>
				db.company.update({
					where: { id },
					data: companyImportData(data),
				}),
			),
		);
	}

	return { imported: validRows.length, errors };
}
