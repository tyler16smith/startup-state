"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import {
	BadgeCheck,
	CalendarClock,
	CreditCard,
	Loader2,
	PauseCircle,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmbeddedCheckoutPanel } from "~/components/billing/embedded-checkout";
import { ReferralShareDialog } from "~/components/billing/referral-share-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
	type BillingStatus,
	createCheckoutSession,
	createPortalSession,
	getBillingPlans,
	syncCheckoutSession,
} from "~/lib/api/billing";
import { useBillingStatus } from "~/lib/hooks/use-billing-status";
import { SettingsSection } from "./settings-section";

function formatUsd(amountUsd: number): string {
	return new Intl.NumberFormat("en-US", {
		currency: "USD",
		maximumFractionDigits: Number.isInteger(amountUsd) ? 0 : 2,
		style: "currency",
	}).format(amountUsd);
}

function getPlanPriceText(data: BillingStatus): string | null {
	if (data.subscriptionPlan === "MONTHLY") {
		return `You're paying ${formatUsd(data.pricing.monthlyPriceUsd)} a month.`;
	}

	if (data.subscriptionPlan === "ANNUAL") {
		return `You're paying ${formatUsd(data.pricing.annualPriceUsd)} a year, ${formatUsd(data.pricing.annualMonthlyEquivalentUsd)} a month with a ${data.pricing.annualDiscountPercent}% discount.`;
	}

	return null;
}

export function BillingSection() {
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();
	const { data, isLoading, refetch } = useBillingStatus();
	const { data: plansData } = useQuery({
		queryKey: ["billing", "plans"],
		queryFn: getBillingPlans,
		staleTime: Number.POSITIVE_INFINITY,
	});
	const [checkoutSession, setCheckoutSession] = useState<{
		clientSecret: string;
		sessionId: string;
	} | null>(null);
	const [syncedReturnSessionId, setSyncedReturnSessionId] = useState<
		string | null
	>(null);

	const checkout = useMutation({
		mutationFn: createCheckoutSession,
		onSuccess: (result) => {
			setCheckoutSession(result);
		},
		onError: (err) => {
			toast.error(
				err instanceof Error ? err.message : "Unable to start checkout",
			);
		},
	});

	const syncCheckout = useMutation({
		mutationFn: syncCheckoutSession,
		onSuccess: (result) => {
			setCheckoutSession(null);
			void queryClient.invalidateQueries({ queryKey: ["billing", "status"] });
			void refetch();
			if (result.subscriptionStatus === "ACTIVE") {
				toast.success("Your subscription is active. Billing status updated.");
			} else {
				toast.message("Checkout complete. Billing status is still updating.");
			}
		},
		onError: (err) => {
			void queryClient.invalidateQueries({ queryKey: ["billing", "status"] });
			void refetch();
			toast.error(
				err instanceof Error ? err.message : "Unable to refresh billing status",
			);
		},
	});

	const portal = useMutation({
		mutationFn: createPortalSession,
		onSuccess: (result) => {
			window.open(result.url, "_blank", "noopener,noreferrer");
		},
		onError: (err) => {
			toast.error(
				err instanceof Error ? err.message : "Unable to open billing portal",
			);
		},
	});

	const isPaidSubscriber = data?.subscriptionStatus === "ACTIVE";
	const planPriceText = data ? getPlanPriceText(data) : null;
	const plans = plansData?.plans ?? [];
	const billingStatus = searchParams.get("billing");
	const returnSessionId = searchParams.get("session_id");

	useEffect(() => {
		if (isPaidSubscriber) {
			setCheckoutSession(null);
		}
	}, [isPaidSubscriber]);

	useEffect(() => {
		if (billingStatus === "return") {
			if (returnSessionId && syncedReturnSessionId !== returnSessionId) {
				setSyncedReturnSessionId(returnSessionId);
				syncCheckout.mutate({ sessionId: returnSessionId });
				return;
			}

			if (!returnSessionId) {
				void refetch();
				toast.success("Checkout complete. Your billing status is refreshing.");
			}
		}

		if (billingStatus === "portal-return") {
			void refetch();
		}
	}, [
		billingStatus,
		refetch,
		returnSessionId,
		syncCheckout,
		syncedReturnSessionId,
	]);

	return (
		<SettingsSection title="Billing">
			{isLoading ? (
				<Card className="py-2">
					<CardContent className="space-y-2 p-4">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-8 w-28" />
					</CardContent>
				</Card>
			) : null}

			{data ? (
				<>
					<Card className="py-2">
						<CardContent className="space-y-3 p-4">
							<div className="flex flex-wrap items-center gap-2">
								{isPaidSubscriber ? (
									<Badge className="gap-1">
										<BadgeCheck className="h-3.5 w-3.5" />
										Active {data.subscriptionPlan.toLowerCase()} plan
									</Badge>
								) : data.canSync ? (
									<Badge variant="secondary">
										Trial: {data.trialDaysLeft} days left
									</Badge>
								) : (
									<Badge className="gap-1" variant="secondary">
										<PauseCircle className="h-3.5 w-3.5" />
										Sync paused
									</Badge>
								)}
								{data.subscriptionCurrentPeriodEnd ? (
									<Badge variant="outline">
										<CalendarClock className="mr-1 h-3.5 w-3.5" />
										{data.subscriptionCancelAtPeriodEnd ? "Ends" : "Renews"} in{" "}
										{formatDistanceToNowStrict(
											new Date(data.subscriptionCurrentPeriodEnd),
										)}
									</Badge>
								) : null}
							</div>

							<p className="text-muted-foreground text-sm leading-relaxed">
								Billing is still wired for paid features. The skeleton app keeps
								subscriptions, trials, and referrals ready for the next product
								idea.
							</p>

							{planPriceText ? (
								<p className="font-medium text-sm">{planPriceText}</p>
							) : null}

							{isPaidSubscriber ? (
								<Button
									disabled={portal.isPending}
									onClick={() => portal.mutate()}
								>
									{portal.isPending ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<CreditCard className="mr-2 h-4 w-4" />
									)}
									Manage billing
								</Button>
							) : (
								<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
									{plans.map((plan) => (
										<Button
											disabled={checkout.isPending}
											key={plan.key}
											onClick={() => checkout.mutate({ plan: plan.key })}
											variant={plan.key === "monthly" ? "outline" : "default"}
										>
											{checkout.isPending ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : null}
											{plan.displayPrice}
											{plan.displaySubtext ? ` (${plan.displaySubtext})` : ""}
										</Button>
									))}
								</div>
							)}

							{checkoutSession ? (
								<div className="space-y-3">
									<EmbeddedCheckoutPanel
										clientSecret={checkoutSession.clientSecret}
										onComplete={() =>
											syncCheckout.mutate({
												sessionId: checkoutSession.sessionId,
											})
										}
									/>
									<Button
										onClick={() => setCheckoutSession(null)}
										variant="outline"
									>
										Choose a different plan
									</Button>
								</div>
							) : null}
						</CardContent>
					</Card>

					<Card className="py-2">
						<CardContent className="space-y-3 p-4">
							<h3 className="font-medium text-sm">Referral trial boost</h3>
							<p className="text-muted-foreground text-sm">
								Invite friends and earn one extra week per successful signup.
								They get one week too. You can earn up to four weeks (28 days)
								of extra trial days.
							</p>
							<div className="text-muted-foreground text-xs">
								{data.successfulReferralCount} successful referrals,{" "}
								{data.referralBonusDaysGranted} bonus days granted.
							</div>
							<div className="flex items-center gap-2">
								<ReferralShareDialog
									referralLink={data.referralLink}
									shareCopy={data.shareCopy}
								/>
								<Button onClick={() => void refetch()} variant="ghost">
									Refresh status
								</Button>
							</div>
						</CardContent>
					</Card>
				</>
			) : null}
		</SettingsSection>
	);
}
