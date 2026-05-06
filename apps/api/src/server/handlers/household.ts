import { addDays } from "date-fns";
import { ZodError, z } from "zod";
import { sendHouseholdInviteEmail } from "~/lib/email/send-household-invite-email";
import { logger } from "~/lib/logger";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import { generateInviteTokenPair } from "../lib/household-invite-token";

type ApiError = Error & { status: number };

const INVITE_EXPIRY_DAYS = 7;
const RESEND_COOLDOWN_MS = 60_000;

function createApiError(message: string, status: number): ApiError {
	const error = new Error(message) as ApiError;
	error.status = status;
	return error;
}

function parseWithBadRequest<T>(schema: z.ZodType<T>, body: unknown): T {
	try {
		return schema.parse(body);
	} catch (error) {
		if (error instanceof ZodError) {
			const message = error.issues[0]?.message ?? "Invalid input";
			throw createApiError(message, 400);
		}
		throw error;
	}
}

const createInviteInput = z.object({
	name: z.string().trim().min(1, "Name is required").max(100),
	email: z
		.string()
		.trim()
		.min(1, "Email is required")
		.max(320)
		.email("Valid email is required"),
});

async function getOwnerSummary(ctx: AuthenticatedContext, userId: string) {
	const owner = await ctx.db.user.findUnique({
		where: { id: userId },
		select: { id: true, name: true, email: true },
	});

	if (!owner) {
		throw createApiError("Owner not found", 404);
	}

	if (!owner.email) {
		throw createApiError("Owner email is required", 403);
	}

	return owner;
}

async function expireStalePendingInvites(
	ctx: AuthenticatedContext,
	ownerUserId: string,
) {
	await ctx.db.householdInvite.updateMany({
		where: {
			ownerUserId,
			status: "PENDING",
			expiresAt: { lte: new Date() },
		},
		data: {
			status: "EXPIRED",
		},
	});
}

function getInviteBaseUrl(): string {
	const baseUrl = process.env.APP_BASE_URL?.trim();
	if (!baseUrl) {
		throw createApiError("APP_BASE_URL is not configured", 500);
	}
	return baseUrl.replace(/\/$/, "");
}

function toMembershipSummary(
	membership: {
		id: string;
		status: "ACTIVE" | "REMOVED";
		createdAt: Date;
		updatedAt: Date;
		memberUser: {
			id: string;
			name: string | null;
			email: string | null;
		};
	} | null,
) {
	if (!membership) return null;
	return {
		id: membership.id,
		status: membership.status,
		createdAt: membership.createdAt,
		updatedAt: membership.updatedAt,
		member: {
			id: membership.memberUser.id,
			name: membership.memberUser.name,
			email: membership.memberUser.email,
			access: "FULL_ACCESS" as const,
		},
	};
}

function toInviteSummary(
	invite: {
		id: string;
		inviteeName: string;
		inviteeEmail: string;
		status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
		createdAt: Date;
		expiresAt: Date;
		sentAt: Date | null;
	} | null,
) {
	if (!invite) return null;
	return {
		id: invite.id,
		inviteeName: invite.inviteeName,
		inviteeEmail: invite.inviteeEmail,
		status: invite.status,
		createdAt: invite.createdAt,
		expiresAt: invite.expiresAt,
		sentAt: invite.sentAt,
	};
}

export const household = {
	/**
	 * GET /api/v1/household
	 */
	get: withAuth(async (ctx: AuthenticatedContext) => {
		const ownerUserId = ctx.userId;
		await expireStalePendingInvites(ctx, ownerUserId);

		const [owner, membership, pendingInvite] = await Promise.all([
			getOwnerSummary(ctx, ownerUserId),
			ctx.db.householdMembership.findFirst({
				where: {
					ownerUserId,
					status: "ACTIVE",
				},
				select: {
					id: true,
					status: true,
					createdAt: true,
					updatedAt: true,
					memberUser: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			}),
			ctx.db.householdInvite.findFirst({
				where: {
					ownerUserId,
					status: "PENDING",
					expiresAt: { gt: new Date() },
				},
				select: {
					id: true,
					inviteeName: true,
					inviteeEmail: true,
					status: true,
					createdAt: true,
					expiresAt: true,
					sentAt: true,
				},
				orderBy: { createdAt: "desc" },
			}),
		]);

		return {
			owner,
			membership: toMembershipSummary(membership),
			pendingInvite: toInviteSummary(pendingInvite),
		};
	}),

	/**
	 * POST /api/v1/household/invites
	 */
	invites: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const ownerUserId = ctx.userId;
		const input = parseWithBadRequest(createInviteInput, body);
		const normalizedEmail = input.email.trim().toLowerCase();
		const owner = await getOwnerSummary(ctx, ownerUserId);

		if (!owner.email) {
			throw createApiError("Owner email is required to send invites", 403);
		}

		if (normalizedEmail === owner.email.toLowerCase()) {
			throw createApiError("You cannot invite your own email", 403);
		}

		await expireStalePendingInvites(ctx, ownerUserId);

		const [activeMembership, existingPendingInvite] = await Promise.all([
			ctx.db.householdMembership.findFirst({
				where: {
					ownerUserId,
					status: "ACTIVE",
				},
				select: { id: true },
			}),
			ctx.db.householdInvite.findFirst({
				where: {
					ownerUserId,
					status: "PENDING",
					expiresAt: { gt: new Date() },
				},
				select: { id: true },
			}),
		]);

		if (activeMembership) {
			throw createApiError(
				"A household member already exists. Remove them before inviting another.",
				409,
			);
		}

		if (existingPendingInvite) {
			throw createApiError("A pending household invite already exists.", 409);
		}

		const { rawToken, tokenHash } = generateInviteTokenPair();
		const expiresAt = addDays(new Date(), INVITE_EXPIRY_DAYS);
		const inviteUrl = `${getInviteBaseUrl()}/household/accept?token=${encodeURIComponent(rawToken)}`;

		try {
			await sendHouseholdInviteEmail({
				to: normalizedEmail,
				inviteeName: input.name,
				ownerName: owner.name ?? owner.email,
				inviteUrl,
				expiresAt,
			});
		} catch (error) {
			logger.logError("Failed to send household invite email", error, {
				feature: "household",
				operation: "createInvite",
				userId: ownerUserId,
			});
			throw createApiError("Failed to send invite email", 500);
		}

		const invite = await ctx.db.householdInvite.create({
			data: {
				ownerUserId,
				inviteeName: input.name,
				inviteeEmail: normalizedEmail,
				tokenHash,
				status: "PENDING",
				expiresAt,
				sentAt: new Date(),
			},
			select: {
				id: true,
				inviteeName: true,
				inviteeEmail: true,
				status: true,
				createdAt: true,
				expiresAt: true,
				sentAt: true,
			},
		});

		return {
			invite: toInviteSummary(invite),
		};
	}),

	/**
	 * POST /api/v1/household/invites/:inviteId/resend
	 */
	resend: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const ownerUserId = ctx.userId;
		const input = parseWithBadRequest(
			z.object({ inviteId: z.string().trim().min(1, "Invite id is required") }),
			body,
		);

		const owner = await getOwnerSummary(ctx, ownerUserId);

		if (!owner.email) {
			throw createApiError("Owner email is required to resend invites", 403);
		}

		const invite = await ctx.db.householdInvite.findFirst({
			where: {
				id: input.inviteId,
				ownerUserId,
			},
			select: {
				id: true,
				inviteeName: true,
				inviteeEmail: true,
				status: true,
				createdAt: true,
				expiresAt: true,
				sentAt: true,
			},
		});

		if (!invite) {
			throw createApiError("Invite not found", 404);
		}

		if (invite.status !== "PENDING") {
			throw createApiError("Only pending invites can be resent", 409);
		}

		if (invite.expiresAt <= new Date()) {
			await ctx.db.householdInvite.update({
				where: { id: invite.id },
				data: { status: "EXPIRED" },
			});
			throw createApiError("Invite has expired", 409);
		}

		if (
			invite.sentAt &&
			Date.now() - invite.sentAt.getTime() < RESEND_COOLDOWN_MS
		) {
			throw createApiError("Please wait before resending this invite", 429);
		}

		const { rawToken, tokenHash } = generateInviteTokenPair();
		const expiresAt = addDays(new Date(), INVITE_EXPIRY_DAYS);
		const inviteUrl = `${getInviteBaseUrl()}/household/accept?token=${encodeURIComponent(rawToken)}`;

		try {
			await sendHouseholdInviteEmail({
				to: invite.inviteeEmail,
				inviteeName: invite.inviteeName,
				ownerName: owner.name ?? owner.email,
				inviteUrl,
				expiresAt,
			});
		} catch (error) {
			logger.logError("Failed to resend household invite email", error, {
				feature: "household",
				operation: "resendInvite",
				userId: ownerUserId,
				inviteId: invite.id,
			});
			throw createApiError("Failed to send invite email", 500);
		}

		const updatedInvite = await ctx.db.householdInvite.update({
			where: { id: invite.id },
			data: {
				tokenHash,
				expiresAt,
				sentAt: new Date(),
			},
			select: {
				id: true,
				inviteeName: true,
				inviteeEmail: true,
				status: true,
				createdAt: true,
				expiresAt: true,
				sentAt: true,
			},
		});

		return {
			invite: toInviteSummary(updatedInvite),
		};
	}),

	/**
	 * POST /api/v1/household/invites/:inviteId/revoke
	 */
	revoke: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const ownerUserId = ctx.userId;
		const input = parseWithBadRequest(
			z.object({ inviteId: z.string().trim().min(1, "Invite id is required") }),
			body,
		);

		const invite = await ctx.db.householdInvite.findFirst({
			where: {
				id: input.inviteId,
				ownerUserId,
			},
			select: {
				id: true,
				status: true,
				expiresAt: true,
			},
		});

		if (!invite) {
			throw createApiError("Invite not found", 404);
		}

		if (invite.status !== "PENDING") {
			throw createApiError("Only pending invites can be revoked", 409);
		}

		const now = new Date();
		if (invite.expiresAt <= now) {
			await ctx.db.householdInvite.update({
				where: { id: invite.id },
				data: { status: "EXPIRED" },
			});
			throw createApiError("Invite has expired", 409);
		}

		await ctx.db.householdInvite.update({
			where: { id: invite.id },
			data: {
				status: "REVOKED",
				revokedAt: now,
			},
		});

		return {
			success: true,
		};
	}),

	/**
	 * POST /api/v1/household/invites/accept
	 */
	accept: withAuth(async (_ctx: AuthenticatedContext, _body: unknown) => {
		throw createApiError("Invite acceptance is coming soon", 501);
	}),
};
