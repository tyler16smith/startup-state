export const BILLING_PRICING = {
	monthlyPriceUsd: 8,
	annualPriceUsd: 72,
	annualMonthlyEquivalentUsd: 6,
} as const;

export const BILLING_ANNUAL_DISCOUNT_PERCENT = Math.round(
	(1 -
		BILLING_PRICING.annualPriceUsd / (BILLING_PRICING.monthlyPriceUsd * 12)) *
		100,
);

export function formatBillingUsd(amountUsd: number): string {
	return new Intl.NumberFormat("en-US", {
		currency: "USD",
		maximumFractionDigits: Number.isInteger(amountUsd) ? 0 : 2,
		style: "currency",
	}).format(amountUsd);
}
