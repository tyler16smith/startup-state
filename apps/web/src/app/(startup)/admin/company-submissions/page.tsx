import Link from "next/link";
import type React from "react";
import { CompanySubmissionReviewActions } from "~/components/startup/company-submission-review-actions";
import { PageBreadcrumb } from "~/components/startup/page-breadcrumb";
import { Button } from "~/components/ui/button";
import type { Company, CompanyPhoto } from "~/lib/startup-api";
import { apiServer } from "~/lib/startup-server-api";

type SubmissionClaim = {
	id: string;
	workEmail: string;
	explanation?: string | null;
	domainMatches: boolean;
	status: string;
	user: { id: string; email?: string | null; name?: string | null };
};

type CompanySubmission = Company & {
	createdAt: string;
	photos: CompanyPhoto[];
	claims: SubmissionClaim[];
};

export default async function AdminCompanySubmissionsPage() {
	const submissions = await apiServer<CompanySubmission[]>(
		"/api/v1/companies/submissions",
	);
	const currentSubmission = submissions.at(0);

	return (
		<main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
			<PageBreadcrumb
				items={[
					{ label: "Admin", href: "/admin" },
					{ label: "Company submissions" },
				]}
			/>
			<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="font-medium text-emerald-700 text-sm">Admin</p>
					<h1 className="mt-2 font-semibold text-4xl tracking-normal">
						Company submissions
					</h1>
					<p className="mt-3 text-muted-foreground">
						Review public Create company submissions before they appear in the
						directory.
					</p>
				</div>
				<Button asChild variant="outline">
					<Link href="/admin">Back to admin</Link>
				</Button>
			</div>

			{currentSubmission ? (
				<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
					<section className="rounded-lg border bg-white p-6 shadow-sm">
						<div className="mb-6 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<p className="font-medium text-muted-foreground text-sm">
									Submission 1 of {submissions.length}
								</p>
								<h2 className="mt-2 font-semibold text-2xl">
									{currentSubmission.name}
								</h2>
								<p className="mt-1 text-muted-foreground text-sm">
									Submitted {formatDate(currentSubmission.createdAt)}
								</p>
							</div>
							<CompanySubmissionReviewActions
								companyId={currentSubmission.id}
							/>
						</div>
						<ReadableSubmission company={currentSubmission} />
					</section>
					<aside className="rounded-lg border bg-white p-4 shadow-sm">
						<p className="mb-3 font-semibold text-sm">Queue</p>
						<div className="space-y-3">
							{submissions.map((submission, index) => (
								<div className="rounded-md border p-3" key={submission.id}>
									<p className="font-medium text-sm">{submission.name}</p>
									<p className="text-muted-foreground text-xs">
										{index === 0 ? "Current" : `Next ${index}`}
									</p>
								</div>
							))}
						</div>
					</aside>
				</div>
			) : (
				<section className="rounded-lg border bg-white p-8 text-center shadow-sm">
					<h2 className="font-semibold text-2xl">No company submissions</h2>
					<p className="mt-2 text-muted-foreground">
						Public Create company submissions will appear here.
					</p>
				</section>
			)}
		</main>
	);
}

function ReadableSubmission({ company }: { company: CompanySubmission }) {
	const primaryClaim = company.claims.at(0);

	return (
		<div className="flex flex-col gap-6">
			<Section title="Application">
				<div className="grid gap-4 md:grid-cols-2">
					<Detail label="Company name" value={company.name} />
					<Detail label="Status" value={company.status} />
					<Detail label="Website" value={company.websiteUrl} />
					<Detail label="LinkedIn" value={company.linkedinUrl} />
					<Detail label="Stage" value={company.stage} />
					<Detail label="Sector" value={company.sector} />
					<Detail label="Employee range" value={company.employeeRange} />
					<Detail label="Hiring status" value={company.hiringStatus} />
				</div>
				<Detail label="Description" value={company.description} wide />
			</Section>

			<Section title="Location">
				<div className="grid gap-4 md:grid-cols-2">
					<Detail label="Address" value={company.address} />
					<Detail label="City" value={company.city} />
					<Detail label="County" value={company.county} />
					<Detail label="State" value={company.state} />
					<Detail label="Postal code" value={company.postalCode} />
					<Detail
						label="Coordinates"
						value={coordinates(company.latitude, company.longitude)}
					/>
				</div>
			</Section>

			<Section title="Submitter">
				<div className="grid gap-4 md:grid-cols-2">
					<Detail label="Name" value={primaryClaim?.user.name} />
					<Detail label="Account email" value={primaryClaim?.user.email} />
					<Detail label="Work email" value={primaryClaim?.workEmail} />
					<Detail
						label="Domain match"
						value={primaryClaim?.domainMatches ? "Matches" : "Needs review"}
					/>
				</div>
				<Detail label="Explanation" value={primaryClaim?.explanation} wide />
			</Section>

			{company.photos.length > 0 ? (
				<Section title="Photos">
					<div className="grid gap-3 md:grid-cols-2">
						{company.photos.map((photo) => (
							<a
								className="block rounded-md border p-3 text-primary text-sm underline-offset-4 hover:underline"
								href={photo.url}
								key={photo.id ?? photo.url}
								rel="noreferrer"
								target="_blank"
							>
								{photo.url}
							</a>
						))}
					</div>
				</Section>
			) : null}
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="flex flex-col gap-4 rounded-md border p-4">
			<h3 className="font-semibold text-lg">{title}</h3>
			{children}
		</section>
	);
}

function Detail({
	label,
	value,
	wide = false,
}: {
	label: string;
	value?: number | string | null;
	wide?: boolean;
}) {
	const displayValue =
		value === undefined || value === null || value === "" ? "-" : value;

	return (
		<div className={wide ? "md:col-span-2" : undefined}>
			<p className="font-medium text-muted-foreground text-xs uppercase tracking-normal">
				{label}
			</p>
			<p className="mt-1 whitespace-pre-wrap break-words text-sm">
				{displayValue}
			</p>
		</div>
	);
}

function coordinates(latitude?: number | null, longitude?: number | null) {
	if (latitude === undefined || latitude === null) return null;
	if (longitude === undefined || longitude === null) return null;
	return `${latitude}, ${longitude}`;
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}
