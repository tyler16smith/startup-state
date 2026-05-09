"use client";

import { Check, Loader2, Pause, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { apiClient } from "~/lib/startup-api";

type ClaimStatus =
	| "email_pending"
	| "pending_review"
	| "on_hold"
	| "approved"
	| "rejected";

type ClaimAction = "approveClaim" | "holdClaim" | "rejectClaim";

export function ClaimActions({
	claimId,
	status,
}: {
	claimId: string;
	status: ClaimStatus;
}) {
	const router = useRouter();
	const [pendingAction, setPendingAction] = useState<ClaimAction | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function review(action: ClaimAction) {
		setPendingAction(action);
		setError(null);
		try {
			await apiClient(`/api/v1/companies/${action}`, {
				method: "POST",
				body: JSON.stringify({ claimId }),
			});
			router.refresh();
		} catch (caughtError) {
			setError(
				caughtError instanceof Error
					? caughtError.message
					: "Could not review claim",
			);
		} finally {
			setPendingAction(null);
		}
	}

	const canResolve = status === "pending_review" || status === "on_hold";
	const canHold = status === "pending_review";
	const disabled = pendingAction !== null;

	return (
		<div className="space-y-2">
			<div className="flex flex-col justify-end gap-2 sm:flex-row">
				<Button
					disabled={!canResolve || disabled}
					onClick={() => review("approveClaim")}
					size="sm"
					type="button"
				>
					{pendingAction === "approveClaim" ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Check className="size-4" />
					)}
					Approve
				</Button>
				<Button
					disabled={!canHold || disabled}
					onClick={() => review("holdClaim")}
					size="sm"
					type="button"
					variant="secondary"
				>
					{pendingAction === "holdClaim" ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Pause className="size-4" />
					)}
					Hold
				</Button>
				<Button
					disabled={!canResolve || disabled}
					onClick={() => review("rejectClaim")}
					size="sm"
					type="button"
					variant="destructive"
				>
					{pendingAction === "rejectClaim" ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<X className="size-4" />
					)}
					Reject
				</Button>
			</div>
			{error ? (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
