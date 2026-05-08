import Link from "next/link";
import { AdminCompaniesTable } from "~/components/startup/admin-companies-table";
import { PageBreadcrumb } from "~/components/startup/page-breadcrumb";
import { Button } from "~/components/ui/button";
import type { Company, Paginated } from "~/lib/startup-api";
import { apiServer } from "~/lib/startup-server-api";

export default async function AdminCompaniesPage() {
	const companies = await apiServer<Paginated<Company>>(
		"/api/v1/companies/adminList",
		{ limit: 100 },
	);
	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<PageBreadcrumb
				items={[
					{ label: "Admin", href: "/admin" },
					{ label: "Companies" },
				]}
			/>
			<div className="mb-8 flex items-end justify-between">
				<div>
					<p className="font-medium text-emerald-700 text-sm">Admin</p>
					<h1 className="mt-2 font-semibold text-4xl tracking-normal">
						Companies
					</h1>
				</div>
				<Button asChild>
					<Link href="/admin/companies/new">New company</Link>
				</Button>
			</div>
			<AdminCompaniesTable companies={companies.items} />
		</main>
	);
}
