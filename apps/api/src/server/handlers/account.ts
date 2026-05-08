import { z } from "zod";
import { logger } from "~/lib/logger";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import { revokeAllUserTokens } from "../lib/token-manager";

const deleteAccountInput = z.object({
	email: z.string().email("Valid email is required"),
	confirmation: z.literal(true, {
		errorMap: () => ({ message: "You must confirm account deletion" }),
	}),
});

const updateProfileInput = z.object({
	name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

export const account = {
	/**
	 * Update user profile name
	 * POST /api/v1/account/updateProfile
	 */
	updateProfile: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;

		const input = updateProfileInput.parse(body);

		const updated = await ctx.db.user.update({
			where: { id: userId },
			data: { name: input.name },
			select: { id: true, name: true },
		});

		logger.info("User profile updated", {
			feature: "account",
			operation: "updateProfile",
			userId,
		});

		return { name: updated.name };
	}),
	/**
	 * Permanently delete user account and all associated data
	 * POST /api/v1/account/deleteAccount
	 *
	 * Requires email verification for security.
	 * Immediately deletes the user and all data (cascades via Prisma).
	 */
	deleteAccount: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;

		const input = deleteAccountInput.parse(body);

		// Get user
		const user = await ctx.db.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
			},
		});

		if (!user) throw new Error("User not found");

		// Verify email matches the user's email
		if (input.email.toLowerCase() !== user.email?.toLowerCase()) {
			throw new Error("Email does not match your account");
		}

		// 1. Revoke all sessions and tokens first
		await revokeAllUserTokens(userId);
		await ctx.db.session.deleteMany({
			where: { userId },
		});

		// 2. Delete user (cascades to all related platform data via onDelete: Cascade)
		await ctx.db.user.delete({
			where: { id: userId },
		});

		logger.info("User account permanently deleted", {
			feature: "account",
			operation: "deleteAccount",
			userId,
		});

		return {
			success: true,
			message:
				"Your account and all associated data have been permanently deleted.",
		};
	}),

	/**
	 * Export all user data in JSON format (GDPR data portability)
	 * GET /api/v1/account/exportData
	 *
	 * Returns platform account data, excluding secrets and agent conversation history.
	 */
	exportData: withAuth(async (ctx: AuthenticatedContext) => {
		const { userId } = ctx;

		const [
			user,
			settings,
			accounts,
			authSessions,
			householdInvites,
			householdMembershipsOwned,
			householdMembershipsAsMember,
			mcpPersonalAccessTokens,
			mcpOAuthConnections,
		] = await Promise.all([
			ctx.db.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					name: true,
					email: true,
					emailVerified: true,
					image: true,
					username: true,
					twoFactorEnabled: true,
				},
			}),
			ctx.db.userSettings.findUnique({
				where: { userId },
			}),
			ctx.db.account.findMany({
				where: { userId },
				select: {
					id: true,
					type: true,
					provider: true,
					providerAccountId: true,
				},
			}),
			ctx.db.authSession.findMany({
				where: { userId },
				select: {
					id: true,
					createdAt: true,
					lastActiveAt: true,
					expiresAt: true,
					revokedAt: true,
					deviceInfo: true,
				},
			}),
			ctx.db.householdInvite.findMany({
				where: { ownerUserId: userId },
				select: {
					id: true,
					inviteeName: true,
					inviteeEmail: true,
					status: true,
					expiresAt: true,
					sentAt: true,
					acceptedAt: true,
					revokedAt: true,
					createdAt: true,
				},
			}),
			ctx.db.householdMembership.findMany({
				where: { ownerUserId: userId },
				include: {
					memberUser: { select: { id: true, name: true, email: true } },
				},
			}),
			ctx.db.householdMembership.findMany({
				where: { memberUserId: userId },
				include: {
					ownerUser: { select: { id: true, name: true, email: true } },
				},
			}),
			ctx.db.mcpPersonalAccessToken.findMany({
				where: { userId },
				select: {
					id: true,
					name: true,
					tokenPrefix: true,
					scopes: true,
					clientName: true,
					expiresAt: true,
					revokedAt: true,
					lastUsedAt: true,
					createdAt: true,
				},
			}),
			ctx.db.mcpOAuthAccessToken.findMany({
				where: { userId },
				select: {
					id: true,
					tokenPrefix: true,
					scopes: true,
					expiresAt: true,
					refreshTokenExpiresAt: true,
					revokedAt: true,
					lastUsedAt: true,
					createdAt: true,
					oauthClient: {
						select: { clientId: true, name: true, clientProfile: true },
					},
				},
			}),
		]);

		if (!user) throw new Error("User not found");

		const exportData = {
			exportedAt: new Date().toISOString(),
			exportVersion: "1.0",
			profile: user,
			settings,
			auth: { accounts, sessions: authSessions },
			household: {
				invites: householdInvites,
				membershipsOwned: householdMembershipsOwned,
				membershipsAsMember: householdMembershipsAsMember,
			},
			mcp: {
				personalAccessTokens: mcpPersonalAccessTokens,
				oauthConnections: mcpOAuthConnections,
			},
		};

		return exportData;
	}),
};
