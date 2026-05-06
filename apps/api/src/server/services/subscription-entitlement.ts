import type { PrismaClient } from "../../../generated/prisma";
import { createApiError } from "../api-context";
import {
	BILLING_ANNUAL_DISCOUNT_PERCENT,
	BILLING_PRICING,
} from "./billing-pricing";

type DbClient = PrismaClient;
type SubscriptionStatus =
	| "NONE"
	| "ACTIVE"
	| "PAST_DUE"
	| "CANCELED"
	| "UNPAID";
type SubscriptionPlan = "NONE" | "MONTHLY" | "ANNUAL";

const DAY_MS = 24 * 60 * 60 * 1000;

export const BILLING_CONFIG = {
	trialDays: 30,
	expiringSoonDays: 7,
	...BILLING_PRICING,
	annualDiscountPercent: BILLING_ANNUAL_DISCOUNT_PERCENT,
	referralBonusDays: 7,
	referralMaxBonusDays: 28,
} as const;

export interface EntitlementSnapshot {
	userId: string;
	trialStartedAt: Date;
	trialEndsAt: Date;
	trialDaysLeft: number;
	trialTotalDays: number;
	trialProgressPct: number;
	isTrialActive: boolean;
	isTrialExpiringSoon: boolean;
	subscriptionStatus: SubscriptionStatus;
	subscriptionPlan: SubscriptionPlan;
	subscriptionCurrentPeriodStart: Date | null;
	subscriptionCurrentPeriodEnd: Date | null;
	subscriptionCancelAtPeriodEnd: boolean;
	subscriptionCanceledAt: Date | null;
	subscriptionProviderPriceId: string | null;
	subscriptionInterval: string | null;
	syncAccessStatus: "ACTIVE" | "PAUSED_TRIAL_EXPIRED";
	canSync: boolean;
	hasProAccess: boolean;
	referralCode: string;
	referredByUserId: string | null;
	referralBonusDaysGranted: number;
	successfulReferralCount: number;
	referralBonusDaysRemaining: number;
	pricing: {
		monthlyPriceUsd: number;
		annualPriceUsd: number;
		annualMonthlyEquivalentUsd: number;
		annualDiscountPercent: number;
	};
}

function normalizeReferralCode(raw: string): string {
	return raw.trim().toUpperCase();
}

function extendDate(base: Date, days: number, now: Date): Date {
	const baseline = base.getTime() > now.getTime() ? base : now;
	return new Date(baseline.getTime() + days * DAY_MS);
}

function toDaysLeft(trialEndsAt: Date, now: Date): number {
	const msLeft = trialEndsAt.getTime() - now.getTime();
	if (msLeft <= 0) return 0;
	return Math.ceil(msLeft / DAY_MS);
}

function computeSyncAccess(params: {
	subscriptionStatus: SubscriptionStatus;
	trialEndsAt: Date;
	now: Date;
}): { canSync: boolean; status: "ACTIVE" | "PAUSED_TRIAL_EXPIRED" } {
	const hasSubscription = params.subscriptionStatus === "ACTIVE";
	const trialActive = params.trialEndsAt.getTime() > params.now.getTime();
	const canSync = hasSubscription || trialActive;
	return {
		canSync,
		status: canSync ? "ACTIVE" : "PAUSED_TRIAL_EXPIRED",
	};
}

async function generateUniqueReferralCode(db: DbClient): Promise<string> {
	for (let i = 0; i < 8; i++) {
		const code = Math.random().toString(36).slice(2, 10).toUpperCase();
		if (code.length < 8) continue;
		const existing = await db.user.findUnique({
			where: { referralCode: code },
			select: { id: true },
		});
		if (!existing) return code;
	}

	throw new Error("Failed to allocate referral code");
}

async function ensureReferralCode(
	db: DbClient,
	userId: string,
): Promise<string> {
	const user = await db.user.findUnique({
		where: { id: userId },
		select: { referralCode: true },
	});
	if (!user) throw new Error("User not found");
	if (user.referralCode) return user.referralCode;

	const referralCode = await generateUniqueReferralCode(db);
	const updated = await db.user.update({
		where: { id: userId },
		data: { referralCode },
		select: { referralCode: true },
	});
	return updated.referralCode ?? referralCode;
}

export async function getEntitlementSnapshot(
	db: DbClient,
	userId: string,
): Promise<EntitlementSnapshot> {
	const user = await db.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			trialStartedAt: true,
			trialEndsAt: true,
			subscriptionStatus: true,
			subscriptionPlan: true,
			subscriptionCurrentPeriodStart: true,
			subscriptionCurrentPeriodEnd: true,
			subscriptionCancelAtPeriodEnd: true,
			subscriptionCanceledAt: true,
			subscriptionProviderPriceId: true,
			subscriptionInterval: true,
			syncAccessStatus: true,
			referralCode: true,
			referredByUserId: true,
			referralBonusDaysGranted: true,
			successfulReferralCount: true,
		},
	});

	if (!user) throw createApiError("Unauthorized", 401);

	const referralCode =
		user.referralCode ?? (await ensureReferralCode(db, userId));
	const now = new Date();
	const trialDaysLeft = toDaysLeft(user.trialEndsAt, now);
	const { canSync, status } = computeSyncAccess({
		subscriptionStatus: user.subscriptionStatus,
		trialEndsAt: user.trialEndsAt,
		now,
	});
	if (user.syncAccessStatus !== status) {
		await db.user.update({
			where: { id: userId },
			data: { syncAccessStatus: status },
		});
	}

	const trialUsedDays = BILLING_CONFIG.trialDays - trialDaysLeft;
	const trialProgressPct = Math.min(
		100,
		Math.max(0, Math.round((trialUsedDays / BILLING_CONFIG.trialDays) * 100)),
	);

	return {
		userId,
		trialStartedAt: user.trialStartedAt,
		trialEndsAt: user.trialEndsAt,
		trialDaysLeft,
		trialTotalDays: BILLING_CONFIG.trialDays,
		trialProgressPct,
		isTrialActive: trialDaysLeft > 0,
		isTrialExpiringSoon:
			trialDaysLeft > 0 && trialDaysLeft <= BILLING_CONFIG.expiringSoonDays,
		subscriptionStatus: user.subscriptionStatus,
		subscriptionPlan: user.subscriptionPlan,
		subscriptionCurrentPeriodStart: user.subscriptionCurrentPeriodStart,
		subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
		subscriptionCancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
		subscriptionCanceledAt: user.subscriptionCanceledAt,
		subscriptionProviderPriceId: user.subscriptionProviderPriceId,
		subscriptionInterval: user.subscriptionInterval,
		syncAccessStatus: status,
		canSync,
		hasProAccess: user.subscriptionStatus === "ACTIVE",
		referralCode,
		referredByUserId: user.referredByUserId,
		referralBonusDaysGranted: user.referralBonusDaysGranted,
		successfulReferralCount: user.successfulReferralCount,
		referralBonusDaysRemaining: Math.max(
			0,
			BILLING_CONFIG.referralMaxBonusDays - user.referralBonusDaysGranted,
		),
		pricing: {
			monthlyPriceUsd: BILLING_CONFIG.monthlyPriceUsd,
			annualPriceUsd: BILLING_CONFIG.annualPriceUsd,
			annualMonthlyEquivalentUsd: BILLING_CONFIG.annualMonthlyEquivalentUsd,
			annualDiscountPercent: BILLING_CONFIG.annualDiscountPercent,
		},
	};
}

export async function assertSyncAccessOrThrow(
	db: DbClient,
	userId: string,
): Promise<EntitlementSnapshot> {
	const snapshot = await getEntitlementSnapshot(db, userId);
	if (!snapshot.canSync) {
		throw createApiError(
			"Bank sync is paused because your trial ended. Upgrade to resume ongoing bank sync.",
			402,
		);
	}
	return snapshot;
}

export async function applyReferralCodeForUser(
	db: DbClient,
	params: { userId: string; referralCode: string },
): Promise<{
	applied: boolean;
	reason?: "self_referral" | "invalid_code" | "already_attributed";
	referrerName?: string | null;
}> {
	const referralCode = normalizeReferralCode(params.referralCode);
	if (!referralCode) {
		return { applied: false, reason: "invalid_code" };
	}

	const [user, referrer] = await Promise.all([
		db.user.findUnique({
			where: { id: params.userId },
			select: { id: true, referredByUserId: true },
		}),
		db.user.findUnique({
			where: { referralCode },
			select: { id: true, name: true },
		}),
	]);

	if (!user || !referrer) {
		return { applied: false, reason: "invalid_code" };
	}
	if (user.id === referrer.id) {
		return { applied: false, reason: "self_referral" };
	}
	if (user.referredByUserId) {
		return { applied: false, reason: "already_attributed" };
	}

	await db.user.update({
		where: { id: user.id },
		data: { referredByUserId: referrer.id },
	});

	return { applied: true, referrerName: referrer.name };
}

export async function grantReferralBonusIfEligible(
	db: DbClient,
	params: { userId: string },
): Promise<{
	applied: boolean;
	reason?: "no_referrer" | "already_redeemed";
	bonusDaysToReferrer?: number;
	bonusDaysToReferred?: number;
}> {
	const referred = await db.user.findUnique({
		where: { id: params.userId },
		select: {
			id: true,
			referredByUserId: true,
			trialEndsAt: true,
			subscriptionStatus: true,
		},
	});
	if (!referred?.referredByUserId) {
		return { applied: false, reason: "no_referrer" };
	}

	const [existingRedemption, referrer] = await Promise.all([
		db.referralRedemption.findUnique({
			where: { referredUserId: referred.id },
			select: { id: true },
		}),
		db.user.findUnique({
			where: { id: referred.referredByUserId },
			select: {
				id: true,
				trialEndsAt: true,
				referralBonusDaysGranted: true,
				subscriptionStatus: true,
				successfulReferralCount: true,
			},
		}),
	]);

	if (existingRedemption) {
		return { applied: false, reason: "already_redeemed" };
	}
	if (!referrer) {
		return { applied: false, reason: "no_referrer" };
	}

	const bonusDaysToReferrer = Math.min(
		BILLING_CONFIG.referralBonusDays,
		Math.max(
			0,
			BILLING_CONFIG.referralMaxBonusDays - referrer.referralBonusDaysGranted,
		),
	);
	const bonusDaysToReferred = BILLING_CONFIG.referralBonusDays;
	const now = new Date();
	const nextReferrerTrialEnd = extendDate(
		referrer.trialEndsAt,
		bonusDaysToReferrer,
		now,
	);
	const nextReferredTrialEnd = extendDate(
		referred.trialEndsAt,
		bonusDaysToReferred,
		now,
	);

	await db.$transaction(async (tx) => {
		await tx.referralRedemption.create({
			data: {
				referrerUserId: referrer.id,
				referredUserId: referred.id,
				bonusDaysToReferrer,
				bonusDaysToReferred,
			},
		});

		await tx.user.update({
			where: { id: referrer.id },
			data: {
				trialEndsAt: nextReferrerTrialEnd,
				referralBonusDaysGranted: {
					increment: bonusDaysToReferrer,
				},
				successfulReferralCount: { increment: 1 },
				syncAccessStatus:
					referrer.subscriptionStatus === "ACTIVE" ||
					nextReferrerTrialEnd.getTime() > now.getTime()
						? "ACTIVE"
						: "PAUSED_TRIAL_EXPIRED",
			},
		});

		await tx.user.update({
			where: { id: referred.id },
			data: {
				trialEndsAt: nextReferredTrialEnd,
				syncAccessStatus:
					referred.subscriptionStatus === "ACTIVE" ||
					nextReferredTrialEnd.getTime() > now.getTime()
						? "ACTIVE"
						: "PAUSED_TRIAL_EXPIRED",
			},
		});
	});

	return {
		applied: true,
		bonusDaysToReferrer,
		bonusDaysToReferred,
	};
}
