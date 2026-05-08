import Link from "next/link";
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
		<main className="w-full px-4 py-10 sm:px-6 lg:px-8 max-w-5xl mx-auto">
			<div className="mb-8">
				<p className="font-medium text-emerald-700 text-sm">Admin</p>
				<h1 className="mt-2 font-semibold text-4xl tracking-normal">
					Content operations
				</h1>
				<p className="mt-3 text-muted-foreground">
					Update resources, companies, imports, and claims without redeploying.
				</p>
			</div>
			<section className="grid gap-6 lg:grid-cols-2">
				<DashboardCard
					addHref="/admin/resources/new"
					items={summary.resources}
					manageHref="/admin/resources"
					title="Resources"
					total={summary.resourceCount}
				/>
				<DashboardCard
					addHref="/admin/companies/new"
					items={summary.companies}
					manageHref="/admin/companies"
					title="Companies"
					total={summary.companyCount}
				/>
			</section>
		</main>
	);
}

function DashboardCard({
	title,
	total,
	items,
	manageHref,
	addHref,
}: {
	title: string;
	total: number;
	items: Array<{ id: string; name: string; status: string }>;
	manageHref: string;
	addHref: string;
}) {
	return (
		<div className="rounded-lg border bg-white p-5 shadow-sm">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="font-semibold text-lg">{title}</h2>
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
						className="rounded-lg border p-3"
						key={item.id}
					>
						<p className="font-medium text-sm">{item.name}</p>
						<p className="text-muted-foreground text-xs">{item.status}</p>
					</div>
				))}
			</div>
		</div>
	);
}
