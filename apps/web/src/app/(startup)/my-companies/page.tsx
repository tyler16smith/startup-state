import {
	ArrowUpRight,
	Building2,
	CheckCircle2,
	Clock3,
	Pencil,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import type { CompanyClaimStatus, MyCompany } from "~/lib/startup-api";
import { compactDate } from "~/lib/startup-api";
import { listMyCompanies } from "~/lib/startup-server-api";
import { auth } from "~/server/auth";

const claimStatusLabel: Record<CompanyClaimStatus, string> = {
	email_pending: "email pending",
	pending_review: "pending review",
	on_hold: "on hold",
	approved: "approved",
	rejected: "rejected",
};

const listingStatusLabel: Record<string, string> = {
	DRAFT: "draft",
	PENDING_REVIEW: "pending review",
	PUBLISHED: "published",
	ARCHIVED: "archived",
};

const relationshipLabel: Record<MyCompany["relationship"], string> = {
	owner: "Claimed",
	submitted: "Submitted",
	claim: "Claim",
};

export default async function MyCompaniesPage() {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin?callbackUrl=/my-companies");

	const companies = await listMyCompanies();

	return (
		<main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
			<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="font-medium text-emerald-700 text-sm">Workspace</p>
					<h1 className="mt-2 font-semibold text-4xl tracking-normal">
						My companies
					</h1>
					<p className="mt-3 text-muted-foreground">
						Companies you submitted for review and listings you have claimed.
					</p>
				</div>
				<Button asChild>
					<Link href="/companies/new">
						<Building2 className="size-4" /> Add company
					</Link>
				</Button>
			</div>

			{companies.length ? (
				<CompaniesTable companies={companies} />
			) : (
				<EmptyState />
			)}
		</main>
	);
}

function CompaniesTable({ companies }: { companies: MyCompany[] }) {
	return (
		<div className="overflow-x-auto rounded-lg border bg-white p-4 shadow-sm">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Company</TableHead>
						<TableHead>Relationship</TableHead>
						<TableHead>Listing</TableHead>
						<TableHead>Review</TableHead>
						<TableHead>Updated</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{companies.map((entry) => (
						<TableRow key={entry.company.id}>
							<TableCell className="max-w-[18rem]">
								<p className="truncate font-medium" title={entry.company.name}>
									{entry.company.name}
								</p>
								<p className="truncate text-muted-foreground text-sm">
									{companyMeta(entry)}
								</p>
							</TableCell>
							<TableCell>{relationshipLabel[entry.relationship]}</TableCell>
							<TableCell>
								<StatusBadge status={entry.company.status} />
							</TableCell>
							<TableCell>
								{entry.claimStatus ? (
									<ClaimBadge status={entry.claimStatus} />
								) : (
									<span className="text-muted-foreground">-</span>
								)}
							</TableCell>
							<TableCell>{compactDate(entry.updatedAt)}</TableCell>
							<TableCell className="text-right">
								<div className="flex justify-end gap-2">
									{entry.claimStatus === "email_pending" && entry.claimId ? (
										<Button asChild size="sm" variant="outline">
											<Link href={`/claims/${entry.claimId}/verify-email`}>
												<Clock3 className="size-4" /> Verify
											</Link>
										</Button>
									) : null}
									{entry.company.status === "PUBLISHED" ? (
										<Button asChild size="sm" variant="outline">
											<Link href={`/companies/${entry.company.id}`}>
												<ArrowUpRight className="size-4" /> View
											</Link>
										</Button>
									) : null}
									{entry.canEdit ? (
										<Button asChild size="sm">
											<Link href={`/companies/${entry.company.id}/edit`}>
												<Pencil className="size-4" /> Edit
											</Link>
										</Button>
									) : null}
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function EmptyState() {
	return (
		<section className="rounded-lg border bg-white p-8 text-center shadow-sm">
			<div className="mx-auto flex size-12 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
				<Building2 className="size-6" />
			</div>
			<h2 className="mt-4 font-semibold text-2xl">No companies yet</h2>
			<p className="mx-auto mt-2 max-w-lg text-muted-foreground">
				Submitted listings and approved claims will appear here.
			</p>
			<div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
				<Button asChild>
					<Link href="/companies/new">
						<Building2 className="size-4" /> Add company
					</Link>
				</Button>
				<Button asChild variant="outline">
					<Link href="/map">Browse companies</Link>
				</Button>
			</div>
		</section>
	);
}

function StatusBadge({ status }: { status: string }) {
	const label = listingStatusLabel[status] ?? status.toLowerCase();
	return (
		<Badge variant={status === "PUBLISHED" ? "default" : "secondary"}>
			{label}
		</Badge>
	);
}

function ClaimBadge({ status }: { status: CompanyClaimStatus }) {
	const approved = status === "approved";
	return (
		<Badge className="gap-1" variant={approved ? "default" : "secondary"}>
			{approved ? <CheckCircle2 className="size-3" /> : null}
			{claimStatusLabel[status]}
		</Badge>
	);
}

function companyMeta(entry: MyCompany) {
	return (
		[entry.company.city, entry.company.sector].filter(Boolean).join(" - ") ||
		"Utah startup"
	);
}
