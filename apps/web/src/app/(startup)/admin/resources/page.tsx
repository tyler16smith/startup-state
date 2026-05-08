import Link from "next/link";
import { ResourceCsvImportForm } from "~/components/startup/resource-csv-import-form";
import { Button } from "~/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import type { Paginated, Resource } from "~/lib/startup-api";
import { apiServer } from "~/lib/startup-server-api";

export default async function AdminResourcesPage() {
	const resources = await apiServer<Paginated<Resource>>(
		"/api/v1/resources/adminList",
		{ limit: 100 },
	);
	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<Header
				href="/admin/resources/new"
				label="New resource"
				title="Resources"
			/>
			<div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
				<div className="rounded-lg border bg-white p-4 shadow-sm">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Category</TableHead>
								<TableHead>Source ID</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{resources.items.map((resource) => (
								<TableRow key={resource.id}>
									<TableCell className="font-medium">{resource.name}</TableCell>
									<TableCell>{resource.status}</TableCell>
									<TableCell>{resource.category ?? "-"}</TableCell>
									<TableCell>{resource.sourceId ?? "-"}</TableCell>
									<TableCell className="text-right">
										<Button asChild size="sm" variant="outline">
											<Link href={`/admin/resources/${resource.id}/edit`}>
												Edit
											</Link>
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
				<ResourceCsvImportForm />
			</div>
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
				<p className="font-medium text-emerald-700 text-sm">Admin</p>
				<h1 className="mt-2 font-semibold text-4xl tracking-normal">{title}</h1>
			</div>
			<Button asChild>
				<Link href={href}>{label}</Link>
			</Button>
		</div>
	);
}
