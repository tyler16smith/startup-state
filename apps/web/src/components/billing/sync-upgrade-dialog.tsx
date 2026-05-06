"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmbeddedCheckoutPanel } from "~/components/billing/embedded-checkout";
import { ReferralShareDialog } from "~/components/billing/referral-share-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { createCheckoutSession, syncCheckoutSession } from "~/lib/api/billing";

interface SyncUpgradeDialogProps {
	triggerLabel: string;
	triggerVariant?: "default" | "outline" | "secondary" | "ghost" | "link";
	triggerClassName?: string;
	trialDaysLeft?: number;
	trialEnded?: boolean;
	referralLink?: string;
	shareCopy?: string;
}

export function SyncUpgradeDialog({
	triggerLabel,
	triggerVariant = "default",
	triggerClassName,
	trialDaysLeft,
	trialEnded = false,
	referralLink,
	shareCopy,
}: SyncUpgradeDialogProps) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [isReferralOpen, setIsReferralOpen] = useState(false);
	const [checkoutSession, setCheckoutSession] = useState<{
		clientSecret: string;
		sessionId: string;
	} | null>(null);
	const [plan, setPlan] = useState<"monthly" | "annual">("annual");

	function handleShareFinClick() {
		if (!referralLink || !shareCopy) {
			toast.message("Referral sharing is not available right now.");
			return;
		}

		setOpen(false);
		setIsReferralOpen(true);
	}

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
			void queryClient.invalidateQueries({ queryKey: ["billing", "status"] });
			setCheckoutSession(null);
			if (result.subscriptionStatus === "ACTIVE") {
				toast.success("Your subscription is active.");
				setOpen(false);
				return;
			}

			toast.message("Checkout complete. Billing status is still updating.");
		},
		onError: (err) => {
			void queryClient.invalidateQueries({ queryKey: ["billing", "status"] });
			toast.error(
				err instanceof Error ? err.message : "Unable to refresh billing status",
			);
		},
	});

	return (
		<>
			<Dialog
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen);
					if (!nextOpen) setCheckoutSession(null);
				}}
				open={open}
			>
				<DialogTrigger asChild>
					<Button className={triggerClassName} variant={triggerVariant}>
						{triggerLabel}
					</Button>
				</DialogTrigger>
				<DialogContent className="!max-w-3xl max-h-[95vh] overflow-y-auto">
					<DialogHeader className="items-center text-center">
						<DialogTitle className="text-xl">
							Upgrade to keep your accounts in sync
						</DialogTitle>
						<DialogDescription className="max-w-md text-center">
							Automatic syncing keeps your transactions, balances, and insights
							up to date. Your data stays here even if you do not upgrade.
						</DialogDescription>
					</DialogHeader>

					{checkoutSession ? (
						<div className="space-y-4">
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
					) : (
						<div className="space-y-5">
							<div className="flex justify-center">
								<div
									aria-label="Billing plan"
									className="inline-flex rounded-lg border bg-muted/40 p-1"
									role="tablist"
								>
									<Button
										aria-selected={plan === "monthly"}
										className="h-8 rounded-md px-4"
										onClick={() => setPlan("monthly")}
										role="tab"
										variant={plan === "monthly" ? "default" : "ghost"}
									>
										Monthly
									</Button>
									<Button
										aria-selected={plan === "annual"}
										className="flex h-8 items-center gap-2 rounded-md px-4"
										onClick={() => setPlan("annual")}
										role="tab"
										variant={plan === "annual" ? "default" : "ghost"}
									>
										Annual{" "}
										<span className="text-xs opacity-90">(Save 25%)</span>
									</Button>
								</div>
							</div>

							<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
								<div className="rounded-md border p-4">
									<p className="text-muted-foreground text-xs uppercase tracking-wide">
										For individuals
									</p>
									<div className="mt-2 space-y-1">
										<p className="font-semibold text-2xl">Basic</p>
										<p className="font-bold text-muted-foreground text-sm">
											Free
										</p>
									</div>
									<ul className="mt-4 space-y-2 text-sm">
										<li className="flex items-start gap-2">
											<Check className="mt-0.5 h-4 w-4 text-emerald-600" />
											<span>View all historical transactions</span>
										</li>
										<li className="flex items-start gap-2">
											<Check className="mt-0.5 h-4 w-4 text-emerald-600" />
											<span>Budgeting and spending tracking</span>
										</li>
										<li className="flex items-start gap-2">
											<Check className="mt-0.5 h-4 w-4 text-emerald-600" />
											<span>Forecasting and scenarios</span>
										</li>
										<li className="flex items-start gap-2">
											<Check className="mt-0.5 h-4 w-4 text-emerald-600" />
											<span>Manual investments and net worth tracking</span>
										</li>
										<li className="flex items-start gap-2">
											<Check className="mt-0.5 h-4 w-4 text-emerald-600" />
											<span>Edit and manage transactions</span>
										</li>
										<li className="flex items-start gap-2 text-muted-foreground">
											<X className="mt-0.5 h-4 w-4 text-red-500" />
											<span>Automatic account syncing</span>
										</li>
									</ul>
								</div>

								<div className="flex flex-col justify-between rounded-md border border-primary/40 bg-primary/5 p-4">
									<div>
										<div className="flex items-start justify-between gap-3">
											<div className="w-full">
												<div className="flex w-full items-center justify-between gap-2">
													<p className="text-muted-foreground text-xs uppercase tracking-wide">
														For households
													</p>
													<Badge>Recommended</Badge>
												</div>
												<div className="mt-2 flex items-center gap-2">
													<p className="font-semibold text-2xl">Pro</p>
												</div>
												<p className="mt-1 font-semibold text-lg">
													{plan === "annual"
														? "$6/month ($72/year)"
														: "$8/month"}
												</p>
											</div>
										</div>
										<ul className="mt-4 space-y-2 text-sm">
											<li className="flex items-start gap-2">
												<Check className="mt-0.5 h-4 w-4 text-emerald-600" />
												<span>Everything in Basic</span>
											</li>
											<li className="flex items-start gap-2">
												<Check className="mt-0.5 h-4 w-4 text-emerald-600" />
												<span>Automatic account syncing</span>
											</li>
											<li className="flex items-start gap-2">
												<Check className="mt-0.5 h-4 w-4 text-emerald-600" />
												<span>Share with others (household access)</span>
											</li>
										</ul>
									</div>
									<div className="mt-4">
										<Button
											className="w-full"
											disabled={checkout.isPending}
											onClick={() => checkout.mutate({ plan })}
										>
											{checkout.isPending ? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													Preparing checkout
												</>
											) : (
												"Upgrade to Pro"
											)}
										</Button>
									</div>
								</div>
							</div>

							<div className="rounded-md border bg-amber-50/70 p-4">
								<p className="font-medium text-sm">
									{trialEnded
										? "Your free trial has ended"
										: `Your free trial: ${Math.max(
												0,
												trialDaysLeft ?? 0,
											)} days left`}
								</p>
								<p className="mt-2 text-muted-foreground text-sm">
									Do not lose automatic account syncing when your trial ends.
								</p>
								<p className="mt-2 text-muted-foreground text-sm">
									Invite friends and get one extra week each (up to 4 extra
									weeks).
								</p>
								<Button
									className="mt-3"
									onClick={handleShareFinClick}
									variant="outline"
								>
									Share App
								</Button>
							</div>

							<div className="rounded-md border bg-muted/25 p-4">
								<p className="font-medium text-sm">What happens on Basic?</p>
								<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
									Your bank connections pause, but everything you have already
									imported stays. You can still use budgeting, forecasting, and
									manual tracking anytime.
								</p>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button onClick={() => setOpen(false)} variant="ghost">
							Maybe later
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{referralLink && shareCopy ? (
				<ReferralShareDialog
					onOpenChange={setIsReferralOpen}
					open={isReferralOpen}
					referralLink={referralLink}
					shareCopy={shareCopy}
					showTrigger={false}
				/>
			) : null}
		</>
	);
}
