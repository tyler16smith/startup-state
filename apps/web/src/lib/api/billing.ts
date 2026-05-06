import { getCsrfToken } from "@app/client-ts";
import { toApiUrl } from "~/lib/api-url";

type ApiResponse<T> = {
	data?: T;
	error?: {
		message?: string;
	};
};

export interface BillingStatus {
	trialStartedAt: string;
	trialEndsAt: string;
	trialDaysLeft: number;
	trialTotalDays: number;
	trialProgressPct: number;
	isTrialActive: boolean;
	isTrialExpiringSoon: boolean;
	subscriptionStatus: "NONE" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID";
	subscriptionPlan: "NONE" | "MONTHLY" | "ANNUAL";
	subscriptionCurrentPeriodStart: string | null;
	subscriptionCurrentPeriodEnd: string | null;
	subscriptionCancelAtPeriodEnd: boolean;
	subscriptionCanceledAt: string | null;
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
	referralLink: string;
	shareCopy: string;
	pricing: {
		monthlyPriceUsd: number;
		annualPriceUsd: number;
		annualMonthlyEquivalentUsd: number;
		annualDiscountPercent: number;
	};
	limits: {
		bonusDaysPerSuccessfulReferral: number;
		maxReferralBonusDays: number;
	};
}

export interface BillingPlan {
	key: "monthly" | "annual";
	name: string;
	amount: number;
	currency: "usd";
	interval: "month" | "year";
	displayPrice: string;
	displaySubtext?: string;
	displayBadge?: string;
}

async function parseApiResponse<T>(res: Response): Promise<T> {
	const payload = (await res.json()) as ApiResponse<T>;
	if (!res.ok || !payload.data) {
		throw new Error(payload.error?.message || "Request failed");
	}
	return payload.data;
}

export async function getBillingStatus(): Promise<BillingStatus> {
	const res = await fetch(toApiUrl("/api/v1/billing/getStatus"), {
		method: "GET",
		credentials: "include",
	});
	return parseApiResponse<BillingStatus>(res);
}

export async function getBillingPlans(): Promise<{ plans: BillingPlan[] }> {
	const res = await fetch(toApiUrl("/api/v1/billing/getPlans"), {
		method: "GET",
		credentials: "include",
	});
	return parseApiResponse<{ plans: BillingPlan[] }>(res);
}

export async function createCheckoutSession(input: {
	plan: "monthly" | "annual";
}): Promise<{
	clientSecret: string;
	sessionId: string;
}> {
	const csrfToken = await getCsrfToken();
	const res = await fetch(toApiUrl("/api/v1/billing/createCheckoutSession"), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify(input),
	});
	return parseApiResponse<{ clientSecret: string; sessionId: string }>(res);
}

export async function syncCheckoutSession(input: {
	sessionId: string;
}): Promise<{
	canSync: boolean;
	hasProAccess: boolean;
	reason: string | null;
	subscriptionPlan: BillingStatus["subscriptionPlan"];
	subscriptionStatus: BillingStatus["subscriptionStatus"];
	synced: boolean;
}> {
	const csrfToken = await getCsrfToken();
	const res = await fetch(toApiUrl("/api/v1/billing/syncCheckoutSession"), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify(input),
	});
	return parseApiResponse<{
		canSync: boolean;
		hasProAccess: boolean;
		reason: string | null;
		subscriptionPlan: BillingStatus["subscriptionPlan"];
		subscriptionStatus: BillingStatus["subscriptionStatus"];
		synced: boolean;
	}>(res);
}

export async function createPortalSession(): Promise<{ url: string }> {
	const csrfToken = await getCsrfToken();
	const res = await fetch(toApiUrl("/api/v1/billing/createPortalSession"), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify({}),
	});
	return parseApiResponse<{ url: string }>(res);
}

export async function applyReferralCode(input: {
	referralCode: string;
}): Promise<{
	applied: boolean;
	reason?: "self_referral" | "invalid_code" | "already_attributed";
	referrerName?: string | null;
}> {
	const csrfToken = await getCsrfToken();
	const res = await fetch(toApiUrl("/api/v1/billing/applyReferralCode"), {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: JSON.stringify(input),
	});
	return parseApiResponse<{
		applied: boolean;
		reason?: "self_referral" | "invalid_code" | "already_attributed";
		referrerName?: string | null;
	}>(res);
}
