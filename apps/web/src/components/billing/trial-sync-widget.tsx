"use client";

import { Clock3, Gift } from "lucide-react";
import { ReferralShareDialog } from "~/components/billing/referral-share-dialog";
import { SyncUpgradeDialog } from "~/components/billing/sync-upgrade-dialog";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";
import { useBillingStatus } from "~/lib/hooks/use-billing-status";
import { cn } from "~/lib/utils";

export function TrialSyncWidget() {
	const { data, isLoading } = useBillingStatus();

	if (isLoading) {
		return (
			<div className="space-y-2 rounded-md border bg-muted/20 p-3">
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-2 w-full" />
				<Skeleton className="h-8 w-24" />
			</div>
		);
	}

	if (!data) {
		return null;
	}

	if (data.subscriptionStatus === "ACTIVE") {
		return null;
	}

	const trialEnded = !data.isTrialActive;

	return (
		<div
			className={cn(
				"space-y-2 rounded-xl border bg-white p-3 shadow-md",
				data.isTrialExpiringSoon && !trialEnded && "border-amber-500/40",
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-1.5 text-sm">
					<Clock3 className="h-3.5 w-3.5" />
					<span className="font-medium">
						{trialEnded ? "Trial ended" : `${data.trialDaysLeft} days left`}
					</span>
				</div>
				{data.isTrialExpiringSoon && !trialEnded ? (
					<Badge className="text-[10px]" variant="secondary">
						Ending soon
					</Badge>
				) : null}
			</div>

			{!trialEnded ? (
				<Progress className="h-1.5" value={data.trialProgressPct} />
			) : null}

			<p className="text-muted-foreground text-xs leading-relaxed">
				{trialEnded ? (
					"Your account remains available. Upgrade to resume paid features."
				) : (
					<span>
						Get up to <b>four more weeks</b> when you share the app with
						friends.
					</span>
				)}
			</p>

			<div className="flex items-center gap-2">
				{trialEnded ? (
					<SyncUpgradeDialog
						referralLink={data.referralLink}
						shareCopy={data.shareCopy}
						trialDaysLeft={data.trialDaysLeft}
						trialEnded={trialEnded}
						triggerClassName="h-7 px-2.5 text-xs"
						triggerLabel="Upgrade"
					/>
				) : (
					<>
						<ReferralShareDialog
							referralLink={data.referralLink}
							shareCopy={data.shareCopy}
							triggerClassName="h-7 px-2.5 text-xs"
						/>
						<SyncUpgradeDialog
							referralLink={data.referralLink}
							shareCopy={data.shareCopy}
							trialDaysLeft={data.trialDaysLeft}
							trialEnded={trialEnded}
							triggerClassName="h-7 px-2.5 text-xs"
							triggerLabel="Upgrade"
							triggerVariant="ghost"
						/>
					</>
				)}
			</div>

			<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
				<Gift className="h-3 w-3" />
				{data.successfulReferralCount} successful referrals
			</div>
		</div>
	);
}
