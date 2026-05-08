import Link from "next/link";
import { CsvImportForm } from "~/components/startup/csv-import-form";
import { Button } from "~/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import type { Company, Paginated } from "~/lib/startup-api";
import { apiServer } from "~/lib/startup-server-api";

export default async function AdminCompaniesPage() {
	const companies = await apiServer<Paginated<Company>>(
		"/api/v1/companies/adminList",
		{ limit: 100 },
	);
	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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
			<div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
				<div className="rounded-lg border bg-white p-4 shadow-sm">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Sector</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{companies.items.map((company) => (
								<TableRow key={company.id}>
									<TableCell className="font-medium">{company.name}</TableCell>
									<TableCell>{company.status}</TableCell>
									<TableCell>{company.sector ?? "-"}</TableCell>
									<TableCell className="text-right">
										<Button asChild size="sm" variant="outline">
											<Link href={`/admin/companies/${company.id}/edit`}>
												Edit
											</Link>
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
				<CsvImportForm endpoint="/api/v1/companies/import" />
			</div>
		</main>
	);
}
