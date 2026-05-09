import { CheckCircle2, MailCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ClaimEmailVerificationActions } from "~/components/startup/claim-email-verification-actions";
import { Button } from "~/components/ui/button";
import { apiServer } from "~/lib/startup-server-api";

type Claim = {
	id: string;
	companyId: string;
	workEmail: string;
	status: string;
	company: { id: string; name: string };
};

function firstValue(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

export default async function VerifyClaimEmailPage({
	params,
	searchParams,
}: {
	params: Promise<{ claimId: string }>;
	searchParams: Promise<{ token?: string | string[] }>;
}) {
	const { claimId } = await params;
	const token = firstValue((await searchParams).token);

	if (token) {
		try {
			await apiServer<Claim>("/api/v1/companies/verifyClaimEmail", {
				claimId,
				token,
			});
			return <ClaimSubmitted />;
		} catch (error) {
			return <VerificationError message={errorMessage(error)} />;
		}
	}

	const claim = await apiServer<Claim>("/api/v1/companies/getClaim", {
		claimId,
	});

	if (claim.status === "pending_review" || claim.status === "approved") {
		return <ClaimSubmitted />;
	}

	return (
		<main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
			<section className="space-y-6 rounded-lg border bg-white p-6 shadow-sm">
				<div className="flex items-start gap-3">
					<div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
						<MailCheck className="size-5" />
					</div>
					<div>
						<h1 className="font-semibold text-2xl">Verify your email</h1>
						<p className="mt-2 text-muted-foreground">
							We sent a verification link to {claim.workEmail}. Click the link
							in your email to continue your claim.
						</p>
					</div>
				</div>

				<div className="space-y-3 border-t pt-5">
					<p className="font-medium text-sm">Didn't get it?</p>
					<ClaimEmailVerificationActions
						claimId={claim.id}
						companyId={claim.company.id}
					/>
				</div>
			</section>
		</main>
	);
}

function ClaimSubmitted() {
	return (
		<main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
			<section className="space-y-5 rounded-lg border bg-white p-6 shadow-sm">
				<div className="flex items-start gap-3">
					<div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
						<CheckCircle2 className="size-5" />
					</div>
					<div>
						<h1 className="font-semibold text-2xl">Claim submitted</h1>
						<p className="mt-2 text-muted-foreground">
							Your email has been verified and your claim is now pending review.
						</p>
					</div>
				</div>
				<Button asChild variant="outline">
					<Link href="/explore">Back to directory</Link>
				</Button>
			</section>
		</main>
	);
}

function VerificationError({ message }: { message: string }) {
	return (
		<main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
			<section className="space-y-5 rounded-lg border bg-white p-6 shadow-sm">
				<div className="flex items-start gap-3">
					<div className="rounded-md bg-red-50 p-2 text-destructive">
						<TriangleAlert className="size-5" />
					</div>
					<div>
						<h1 className="font-semibold text-2xl">Verification failed</h1>
						<p className="mt-2 text-muted-foreground">{message}</p>
					</div>
				</div>
				<Button asChild variant="outline">
					<Link href="/explore">Back to directory</Link>
				</Button>
			</section>
		</main>
	);
}

function errorMessage(error: unknown) {
	return error instanceof Error
		? error.message
		: "Could not verify claim email";
}
