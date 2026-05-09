import Link from "next/link";
import { AdminResourcesTable } from "~/components/startup/admin-resources-table";
import { PageBreadcrumb } from "~/components/startup/page-breadcrumb";
import { Button } from "~/components/ui/button";
import type { Paginated, Resource } from "~/lib/startup-api";
import { apiServer } from "~/lib/startup-server-api";

export default async function AdminResourcesPage() {
	const resources = await apiServer<Paginated<Resource>>(
		"/api/v1/resources/adminList",
		{ limit: 100 },
	);
	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<PageBreadcrumb
				items={[{ label: "Admin", href: "/admin" }, { label: "Resources" }]}
			/>
			<Header
				href="/admin/resources/new"
				label="New resource"
				title="Resources"
			/>
			<AdminResourcesTable resources={resources.items} />
		</main>
	);
}

function Header({
	title,
	href,
	label,
}: {
	title: string;
	href: string;
	label: string;
}) {
	return (
		<div className="mb-8 flex items-end justify-between">
			<div>
				<h1 className="font-semibold text-4xl tracking-normal">{title}</h1>
			</div>
			<Button asChild>
				<Link href={href}>{label}</Link>
			</Button>
		</div>
	);
}
