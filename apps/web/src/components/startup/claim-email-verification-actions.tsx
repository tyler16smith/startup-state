"use client";

import { Loader2, Pencil, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { apiClient } from "~/lib/startup-api";

export function ClaimEmailVerificationActions({
	claimId,
	companyId,
}: {
	claimId: string;
	companyId: string;
}) {
	const [resending, setResending] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function resendEmail() {
		setResending(true);
		setMessage(null);
		setError(null);
		try {
			await apiClient("/api/v1/companies/resendClaimVerification", {
				method: "POST",
				body: JSON.stringify({ claimId }),
			});
			setMessage("Verification email sent.");
		} catch (caughtError) {
			setError(
				caughtError instanceof Error
					? caughtError.message
					: "Could not resend verification email",
			);
		} finally {
			setResending(false);
		}
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row">
				<Button disabled={resending} onClick={resendEmail} type="button">
					{resending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<RefreshCw className="size-4" />
					)}{" "}
					Resend email
				</Button>
				<Button asChild variant="outline">
					<Link href={`/companies/${companyId}/claim`}>
						<Pencil className="size-4" /> Change email
					</Link>
				</Button>
			</div>
			{message ? (
				<p className="text-emerald-700 text-sm" role="status">
					{message}
				</p>
			) : null}
			{error ? (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
