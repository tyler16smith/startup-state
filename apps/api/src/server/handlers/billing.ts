import { z } from "zod";
import { logger } from "~/lib/logger";
import { createApiError } from "../api-context";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";
import {
	BILLING_PLANS,
	mapCheckoutPlanToSubscriptionPlan,
} from "../services/stripe.mapper";
import {
	createBillingPortalSession,
	createEmbeddedCheckoutSession,
	retrieveCheckoutSession,
} from "../services/stripe.service";
import { syncStripeCheckoutSessionToUser } from "../services/stripe.webhook";
import {
	applyReferralCodeForUser,
	BILLING_CONFIG,
	getEntitlementSnapshot,
} from "../services/subscription-entitlement";

const applyReferralCodeInput = z.object({
	referralCode: z.string().min(2),
});

const createCheckoutSessionInput = z.object({
	plan: z.enum(["monthly", "annual"]),
});

const syncCheckoutSessionInput = z.object({
	sessionId: z.string().min(1),
});

function getStripeObjectId(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (typeof value !== "object" || value === null) return null;
	if ("id" in value && typeof value.id === "string") return value.id;
	return null;
}

export const billing = {
	getPlans: withDemoOrAuth(async () => {
		return { plans: BILLING_PLANS };
	}),

	getStatus: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		if (ctx.isDemoMode) {
			return {
				planType: "trial" as const,
				planStatus: "active" as const,
				trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
				subscriptionStatus: "NONE" as const,
				subscriptionPlan: "NONE" as const,
				subscriptionCurrentPeriodStart: null,
				subscriptionCurrentPeriodEnd: null,
				subscriptionCancelAtPeriodEnd: false,
				subscriptionCanceledAt: null,
				subscriptionProviderPriceId: null,
				subscriptionInterval: null,
				canSync: true,
				hasProAccess: true,
				referralCode: "DEMO",
				referralCredits: 0,
				referralCount: 0,
				referralLink: "",
				pricing: {
					monthlyPriceUsd: BILLING_CONFIG.monthlyPriceUsd,
					annualPriceUsd: BILLING_CONFIG.annualPriceUsd,
					annualMonthlyEquivalentUsd: BILLING_CONFIG.annualMonthlyEquivalentUsd,
					annualDiscountPercent: BILLING_CONFIG.annualDiscountPercent,
				},
				shareCopy:
					"I've been using this app to organize my account and household setup. Try it free with my link and we both get extra trial time.",
				limits: {
					bonusDaysPerSuccessfulReferral: BILLING_CONFIG.referralBonusDays,
					maxReferralBonusDays: BILLING_CONFIG.referralMaxBonusDays,
				},
			};
		}

		const { userId } = ctx;

		const snapshot = await getEntitlementSnapshot(ctx.db, userId);
		const webOrigin =
			process.env.WEB_ORIGIN ?? process.env.NEXT_PUBLIC_WEB_URL ?? "";
		const referralLink = `${webOrigin}/auth/register?ref=${encodeURIComponent(snapshot.referralCode)}`;

		return {
			...snapshot,
			referralLink,
			shareCopy:
				"I've been using this app to organize my account and household setup. Try it free with my link and we both get extra trial time.",
			limits: {
				bonusDaysPerSuccessfulReferral: BILLING_CONFIG.referralBonusDays,
				maxReferralBonusDays: BILLING_CONFIG.referralMaxBonusDays,
			},
		};
	}),

	applyReferralCode: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;
			const input = applyReferralCodeInput.parse(body);

			return applyReferralCodeForUser(ctx.db, {
				userId,
				referralCode: input.referralCode,
			});
		},
	),

	createCheckoutSession: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;
			const input = createCheckoutSessionInput.parse(body);
			const user = await ctx.db.user.findUnique({
				where: { id: userId },
				select: { subscriptionStatus: true, subscriptionPlan: true },
			});

			if (!user) throw createApiError("Unauthorized", 401);
			if (user.subscriptionStatus === "ACTIVE") {
				throw createApiError(
					"You already have an active subscription. Use Manage Billing to make changes.",
					409,
				);
			}

			try {
				const result = await createEmbeddedCheckoutSession({
					db: ctx.db,
					plan: input.plan,
					userId,
				});

				await logger.info("Stripe checkout session created", {
					feature: "billing",
					operation: "checkoutSession.create",
					plan: mapCheckoutPlanToSubscriptionPlan(input.plan),
					userId,
				});

				return result;
			} catch (error) {
				await logger.logError(
					"Failed to create Stripe checkout session",
					error,
					{
						feature: "billing",
						operation: "checkoutSession.create",
						userId,
					},
				);
				throw error;
			}
		},
	),

	syncCheckoutSession: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;
			const input = syncCheckoutSessionInput.parse(body);
			const [user, session] = await Promise.all([
				ctx.db.user.findUnique({
					where: { id: userId },
					select: { subscriptionProviderCustomerId: true },
				}),
				retrieveCheckoutSession(input.sessionId),
			]);

			if (!user) throw createApiError("Unauthorized", 401);

			const sessionUserId = session.metadata?.userId ?? null;
			const sessionCustomerId = getStripeObjectId(session.customer);
			const ownsSession =
				sessionUserId === userId ||
				Boolean(
					sessionCustomerId &&
						user.subscriptionProviderCustomerId === sessionCustomerId,
				);

			if (!ownsSession) {
				throw createApiError(
					"Checkout session does not belong to this user",
					403,
				);
			}

			const syncResult = await syncStripeCheckoutSessionToUser({
				db: ctx.db,
				eventId: `checkout.session.sync:${session.id}`,
				fallbackUserId: userId,
				session,
			});
			const snapshot = await getEntitlementSnapshot(ctx.db, userId);

			await logger.info("Stripe checkout session synced", {
				feature: "billing",
				operation: "checkoutSession.sync",
				stripeCheckoutSessionId: session.id,
				subscriptionPlan: snapshot.subscriptionPlan,
				subscriptionStatus: snapshot.subscriptionStatus,
				userId,
			});

			return {
				canSync: snapshot.canSync,
				hasProAccess: snapshot.hasProAccess,
				reason: syncResult.reason,
				subscriptionPlan: snapshot.subscriptionPlan,
				subscriptionStatus: snapshot.subscriptionStatus,
				synced: syncResult.synced,
			};
		},
	),

	createPortalSession: withAuth(async (ctx: AuthenticatedContext) => {
		const { userId } = ctx;
		const user = await ctx.db.user.findUnique({
			where: { id: userId },
			select: { subscriptionProviderCustomerId: true },
		});

		if (!user) throw createApiError("Unauthorized", 401);
		if (!user.subscriptionProviderCustomerId) {
			throw createApiError("No billing customer found for this account", 409);
		}

		try {
			const result = await createBillingPortalSession({
				customerId: user.subscriptionProviderCustomerId,
			});

			await logger.info("Stripe portal session created", {
				feature: "billing",
				operation: "portalSession.create",
				userId,
			});

			return result;
		} catch (error) {
			await logger.logError("Failed to create Stripe portal session", error, {
				feature: "billing",
				operation: "portalSession.create",
				userId,
			});
			throw error;
		}
	}),
};
