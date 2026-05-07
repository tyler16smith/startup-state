import { Building2, Clock, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { SiteShell } from "~/components/startup/site-shell";
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

const statCards = [
	{ icon: FileText, label: "Resources", key: "resourceCount" },
	{ icon: Building2, label: "Companies", key: "companyCount" },
	{ icon: ShieldCheck, label: "Pending claims", key: "pendingClaims" },
	{ icon: Clock, label: "Pending submissions", key: "pendingCompanies" },
] as const;

export default async function AdminPage() {
	const summary = await apiServer<AdminSummary>(
		"/api/v1/companies/adminSummary",
	);
	return (
		<SiteShell>
			<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
				<div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
					<div>
						<p className="font-medium text-emerald-700 text-sm">Admin</p>
						<h1 className="mt-2 font-semibold text-4xl tracking-normal">
							Content operations
						</h1>
						<p className="mt-3 text-muted-foreground">
							Update resources, companies, imports, and claims without
							redeploying.
						</p>
					</div>
					<div className="flex gap-2">
						<Button asChild>
							<Link href="/admin/resources/new">New resource</Link>
						</Button>
						<Button asChild variant="outline">
							<Link href="/admin/companies/new">New company</Link>
						</Button>
					</div>
				</div>
				<section className="grid gap-5 md:grid-cols-4">
					{statCards.map(({ icon: Icon, label, key }) => (
						<div className="rounded-lg border bg-white p-5 shadow-sm" key={key}>
							<Icon className="size-5 text-emerald-700" />
							<p className="mt-3 text-muted-foreground text-sm">{label}</p>
							<p className="mt-1 font-semibold text-3xl">{summary[key]}</p>
						</div>
					))}
				</section>
				<section className="mt-8 grid gap-6 lg:grid-cols-2">
					<Recent
						href="/admin/resources"
						items={summary.resources}
						title="Recently updated resources"
					/>
					<Recent
						href="/admin/companies"
						items={summary.companies}
						title="Recently updated companies"
					/>
				</section>
			</main>
		</SiteShell>
	);
}

function Recent({
	title,
	items,
	href,
}: {
	title: string;
	items: Array<{ id: string; name: string; status: string }>;
	href: string;
}) {
	return (
		<div className="rounded-lg border bg-white p-5 shadow-sm">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="font-semibold">{title}</h2>
				<Button asChild size="sm" variant="outline">
					<Link href={href}>Manage</Link>
				</Button>
			</div>
			<div className="space-y-2">
				{items.map((item) => (
					<div
						className="flex items-center justify-between rounded-lg border p-3"
						key={item.id}
					>
						<span className="font-medium">{item.name}</span>
						<span className="text-muted-foreground text-xs">{item.status}</span>
					</div>
				))}
			</div>
		</div>
	);
}
