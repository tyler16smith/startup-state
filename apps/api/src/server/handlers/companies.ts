import { createApiError } from "~/server/api-context";
import {
	type AuthenticatedContext,
	type PublicHandler,
	withAuth,
	withPublic,
} from "../handler-wrappers";
import {
	requireAdmin,
	requireCompanyEditor,
} from "../services/startup-navigator/authz";
import {
	approveCompanyClaim,
	archiveCompany,
	createCompany,
	createCompanyClaim,
	getAdminSummary,
	getCompanyById,
	getCompanyClaimForUser,
	importCompaniesFromCsv,
	listCompanyClaims,
	listCompanySubmissions,
	rejectCompanyClaim,
	resendCompanyClaimVerification,
	reviewCompanySubmission,
	searchCompanies,
	updateCompany,
	verifyCompanyClaimEmail,
} from "../services/startup-navigator/companies";
import { recommendCompaniesForInvestorProfile } from "../services/startup-navigator/investor-recommendations";
import { idInputSchema } from "../services/startup-navigator/schemas";

function companyIdentifier(body: unknown) {
	const input = idInputSchema.parse(body);
	return input.id ?? input.companyId;
}

function claimIdentifier(body: unknown) {
	const input = idInputSchema.parse(body);
	return input.id ?? input.claimId;
}

export const companies = {
	list: withPublic(async (ctx, body) => {
		return searchCompanies(ctx.db, body);
	}) satisfies PublicHandler,

	get: withPublic(async (ctx, body) => {
		const input = idInputSchema.parse(body);
		return getCompanyById(ctx.db, {
			id: input.id ?? input.companyId,
			slug: input.slug,
		});
	}) satisfies PublicHandler,

	create: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		return createCompany(ctx.db, body, { submittedByUserId: ctx.userId });
	}),

	update: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const companyId = companyIdentifier(body);
		if (!companyId) throw createApiError("Company id required", 400);
		await requireCompanyEditor(ctx, companyId);
		return updateCompany(ctx.db, companyId, body);
	}),

	claim: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const companyId = companyIdentifier(body);
		if (!companyId) throw createApiError("Company id required", 400);
		const input = typeof body === "object" && body !== null ? body : {};
		return createCompanyClaim(ctx.db, ctx.userId, { ...input, companyId });
	}),

	getClaim: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		return getCompanyClaimForUser(ctx.db, ctx.userId, body);
	}),

	resendClaimVerification: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			return resendCompanyClaimVerification(ctx.db, ctx.userId, body);
		},
	),

	verifyClaimEmail: withPublic(async (ctx, body) => {
		return verifyCompanyClaimEmail(ctx.db, body);
	}) satisfies PublicHandler,

	recommend: withPublic(async (ctx, body) => {
		return recommendCompaniesForInvestorProfile(ctx.db, body);
	}) satisfies PublicHandler,

	adminList: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		return searchCompanies(ctx.db, body, { admin: true });
	}),

	adminGet: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const input = idInputSchema.parse(body);
		return getCompanyById(
			ctx.db,
			{ id: input.id ?? input.companyId, slug: input.slug },
			{ admin: true },
		);
	}),

	adminCreate: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		return createCompany(ctx.db, body, { admin: true });
	}),

	adminUpdate: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const companyId = companyIdentifier(body);
		if (!companyId) throw createApiError("Company id required", 400);
		return updateCompany(ctx.db, companyId, body);
	}),

	adminDelete: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const companyId = companyIdentifier(body);
		if (!companyId) throw createApiError("Company id required", 400);
		return archiveCompany(ctx.db, companyId);
	}),

	import: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		return importCompaniesFromCsv(ctx.db, body);
	}),

	claims: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		return listCompanyClaims(ctx.db, body);
	}),

	submissions: withAuth(async (ctx: AuthenticatedContext) => {
		await requireAdmin(ctx);
		return listCompanySubmissions(ctx.db);
	}),

	reviewSubmission: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			await requireAdmin(ctx);
			return reviewCompanySubmission(ctx.db, body, ctx.userId);
		},
	),

	approveClaim: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const claimId = claimIdentifier(body);
		if (!claimId) throw createApiError("Claim id required", 400);
		return approveCompanyClaim(ctx.db, claimId, ctx.userId);
	}),

	rejectClaim: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const claimId = claimIdentifier(body);
		if (!claimId) throw createApiError("Claim id required", 400);
		return rejectCompanyClaim(ctx.db, claimId, ctx.userId);
	}),

	adminSummary: withAuth(async (ctx: AuthenticatedContext) => {
		await requireAdmin(ctx);
		return getAdminSummary(ctx.db);
	}),
};
