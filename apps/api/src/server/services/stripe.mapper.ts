import type Stripe from "stripe";
import {
	BILLING_ANNUAL_DISCOUNT_PERCENT,
	BILLING_PRICING,
	formatBillingUsd,
} from "./billing-pricing";

export type CheckoutPlanKey = "monthly" | "annual";
export type AppSubscriptionPlan = "NONE" | "MONTHLY" | "ANNUAL";
export type AppSubscriptionStatus =
	| "NONE"
	| "ACTIVE"
	| "PAST_DUE"
	| "CANCELED"
	| "UNPAID";
export type BillingInterval = "month" | "year";

export type BillingPlan = {
	key: CheckoutPlanKey;
	name: string;
	amount: number;
	currency: "usd";
	interval: BillingInterval;
	displayPrice: string;
	displaySubtext?: string;
	displayBadge?: string;
};

export const BILLING_PLANS: BillingPlan[] = [
	{
		key: "monthly",
		name: "Pro Monthly",
		amount: BILLING_PRICING.monthlyPriceUsd * 100,
		currency: "usd",
		interval: "month",
		displayPrice: `${formatBillingUsd(BILLING_PRICING.monthlyPriceUsd)}/month`,
	},
	{
		key: "annual",
		name: "Pro Annual",
		amount: BILLING_PRICING.annualPriceUsd * 100,
		currency: "usd",
		interval: "year",
		displayPrice: `${formatBillingUsd(BILLING_PRICING.annualMonthlyEquivalentUsd)}/month`,
		displaySubtext: `billed annually at ${formatBillingUsd(BILLING_PRICING.annualPriceUsd)}/year`,
		displayBadge: `Save ${BILLING_ANNUAL_DISCOUNT_PERCENT}%`,
	},
];

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is not configured`);
	}
	return value;
}

export function getStripePriceIdForPlan(plan: CheckoutPlanKey): string {
	return plan === "monthly"
		? getRequiredEnv("STRIPE_PRICE_MONTHLY")
		: getRequiredEnv("STRIPE_PRICE_ANNUAL");
}

export function mapCheckoutPlanToSubscriptionPlan(
	plan: CheckoutPlanKey,
): "MONTHLY" | "ANNUAL" {
	return plan === "monthly" ? "MONTHLY" : "ANNUAL";
}

export function mapStripePriceIdToPlan(priceId: string): AppSubscriptionPlan {
	if (priceId === process.env.STRIPE_PRICE_MONTHLY) return "MONTHLY";
	if (priceId === process.env.STRIPE_PRICE_ANNUAL) return "ANNUAL";
	return "NONE";
}

export function mapStripeStatusToAppStatus(
	status: Stripe.Subscription.Status,
): AppSubscriptionStatus {
	switch (status) {
		case "active":
		case "trialing":
			return "ACTIVE";
		case "past_due":
			return "PAST_DUE";
		case "unpaid":
			return "UNPAID";
		case "canceled":
		case "incomplete_expired":
			return "CANCELED";
		case "incomplete":
		case "paused":
			return "PAST_DUE";
		default:
			return "NONE";
	}
}

export function mapStripeInterval(
	interval: Stripe.Price.Recurring.Interval | undefined,
): BillingInterval | null {
	if (interval === "month" || interval === "year") return interval;
	return null;
}

export function unixToDate(value: number | null | undefined): Date | null {
	if (!value) return null;
	return new Date(value * 1000);
}

export function getPrimarySubscriptionItem(subscription: Stripe.Subscription) {
	return subscription.items.data.at(0) ?? null;
}
