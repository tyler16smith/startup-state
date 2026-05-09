import { ArrowRight, BookOpen, Building2 } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { EditPencilLink } from "~/app/(startup)/admin/edit-pencil-link";
import { Button } from "~/components/ui/button";
import type { Company, Resource } from "~/lib/startup-api";
import { apiServer } from "~/lib/startup-server-api";

type AdminSummary = {
	resourceCount: number;
	companyCount: number;
	pendingClaims: number;
	pendingCompanies: number;
	resources: Resource[];
	companies: Company[];
};

export default async function AdminPage() {
	const summary = await apiServer<AdminSummary>(
		"/api/v1/companies/adminSummary",
	);
	return (
		<main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
			<div className="mb-8">
				<p className="font-medium text-emerald-700 text-sm">Admin</p>
				<h1 className="mt-2 font-semibold text-4xl tracking-normal">
					Content operations
				</h1>
				<p className="mt-3 text-muted-foreground">
					Update resources, companies, imports, and claims without redeploying.
				</p>
			</div>
			<div className="mb-6 space-y-3">
				{summary.pendingCompanies > 0 ? (
					<ReviewCallout
						count={summary.pendingCompanies}
						href="/admin/company-submissions"
						label="company submissions"
					/>
				) : null}
				{summary.pendingClaims > 0 ? (
					<ReviewCallout
						count={summary.pendingClaims}
						href="/admin/claims"
						label="company claims"
					/>
				) : null}
			</div>
			<section className="grid gap-6 lg:grid-cols-2">
				<DashboardCard
					addHref="/admin/resources/new"
					editBasePath="/admin/resources"
					icon={BookOpen}
					items={summary.resources}
					manageHref="/admin/resources"
					title="Resources"
					total={summary.resourceCount}
				/>
				<DashboardCard
					addHref="/admin/companies/new"
					editBasePath="/admin/companies"
					icon={Building2}
					items={summary.companies}
					manageHref="/admin/companies"
					title="Companies"
					total={summary.companyCount}
				/>
			</section>
		</main>
	);
}

function ReviewCallout({
	count,
	label,
	href,
}: {
	count: number;
	label: string;
	href: string;
}) {
	return (
		<section className="flex w-full flex-col gap-3 rounded-lg border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
			<p className="font-semibold text-lg">
				{count} {label} need a review
			</p>
			<Button asChild>
				<Link href={href}>
					Review now
					<ArrowRight className="size-4" />
				</Link>
			</Button>
		</section>
	);
}

function DashboardCard({
	title,
	total,
	items,
	manageHref,
	addHref,
	editBasePath,
	icon,
}: {
	title: string;
	total: number;
	items: Array<{ id: string; name: string; status: string }>;
	manageHref: string;
	addHref: string;
	editBasePath: string;
	icon?: React.ComponentType<{ className?: string }>;
}) {
	const Icon = icon;
	return (
		<div className="rounded-lg border bg-white p-5 shadow-sm">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="flex items-center gap-1 font-semibold text-lg">
					{Icon ? <Icon className="size-5 text-emerald-500" /> : null}
					{title}
				</h2>
				<div className="flex gap-2">
					<Button asChild size="sm" variant="outline">
						<Link href={manageHref}>Manage</Link>
					</Button>
					<Button asChild size="sm">
						<Link href={addHref}>Add</Link>
					</Button>
				</div>
			</div>
			<p className="mb-4 text-muted-foreground text-sm">{total} total</p>
			<p className="mb-3 font-medium text-sm">Recently updated</p>
			<div className="space-y-2">
				{items.map((item) => (
					<div
						className="flex items-center justify-between rounded-lg border p-3"
						key={item.id}
					>
						<div>
							<p className="font-medium text-sm">{item.name}</p>
							<p className="text-muted-foreground text-xs">{item.status}</p>
						</div>
						<EditPencilLink
							href={`${editBasePath}/${item.id}/edit`}
							label={`Edit ${item.name}`}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
