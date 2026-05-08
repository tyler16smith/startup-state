"use client";

import { Check, Loader2, Pause, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { apiClient } from "~/lib/startup-api";

type ReviewAction = "approve" | "reject" | "hold";

export function CompanySubmissionReviewActions({
	companyId,
}: {
	companyId: string;
}) {
	const router = useRouter();
	const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function review(action: ReviewAction) {
		setPendingAction(action);
		setError(null);
		try {
			await apiClient("/api/v1/companies/reviewSubmission", {
				method: "POST",
				body: JSON.stringify({ companyId, action }),
			});
			router.refresh();
		} catch (caughtError) {
			setError(
				caughtError instanceof Error
					? caughtError.message
					: "Could not review submission",
			);
		} finally {
			setPendingAction(null);
		}
	}

	const disabled = pendingAction !== null;

	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
				<Button disabled={disabled} onClick={() => review("approve")}>
					{pendingAction === "approve" ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Check className="size-4" />
					)}
					Approve
				</Button>
				<Button
					disabled={disabled}
					onClick={() => review("hold")}
					variant="secondary"
				>
					{pendingAction === "hold" ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Pause className="size-4" />
					)}
					Hold
				</Button>
				<Button
					disabled={disabled}
					onClick={() => review("reject")}
					variant="destructive"
				>
					{pendingAction === "reject" ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<X className="size-4" />
					)}
					Reject
				</Button>
			</div>
			{error ? <p className="text-destructive text-sm">{error}</p> : null}
		</div>
	);
}
