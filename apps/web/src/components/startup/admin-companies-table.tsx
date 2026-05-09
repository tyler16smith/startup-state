"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import type { Company } from "~/lib/startup-api";

function companyAddress(company: Company) {
	return [company.address, company.city, company.state, company.postalCode]
		.filter(Boolean)
		.join(", ");
}

export function AdminCompaniesTable({ companies }: { companies: Company[] }) {
	const [query, setQuery] = useState("");
	const filteredCompanies = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) return companies;
		return companies.filter((company) =>
			company.name.toLowerCase().includes(normalizedQuery),
		);
	}, [companies, query]);

	return (
		<section className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative w-full sm:max-w-sm">
					<Search
						aria-hidden="true"
						className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						aria-label="Search company names"
						className="pl-9"
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search company names"
						value={query}
					/>
				</div>
				<p className="text-muted-foreground text-sm">
					{filteredCompanies.length} of {companies.length} companies
				</p>
			</div>
			<div className="rounded-lg border bg-white p-4 shadow-sm">
				<Table>
					<TableCaption>Companies awaiting admin management</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Sector</TableHead>
							<TableHead>Address</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredCompanies.map((company) => {
							const address = companyAddress(company);
							return (
								<TableRow key={company.id}>
									<TableCell className="max-w-[14rem] font-medium">
										<span className="block truncate" title={company.name}>
											{company.name}
										</span>
									</TableCell>
									<TableCell>{company.status}</TableCell>
									<TableCell>{company.sector ?? "-"}</TableCell>
									<TableCell className="max-w-[18rem]">
										<span
											className="block truncate"
											title={address || undefined}
										>
											{address || "-"}
										</span>
									</TableCell>
									<TableCell className="text-right">
										<Button asChild size="sm" variant="outline">
											<Link
												aria-label={`Edit ${company.name}`}
												href={`/admin/companies/${company.id}/edit`}
											>
												Edit
											</Link>
										</Button>
									</TableCell>
								</TableRow>
							);
						})}
						{filteredCompanies.length === 0 && (
							<TableRow>
								<TableCell
									className="h-24 text-center text-muted-foreground"
									colSpan={5}
								>
									No companies match your search.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}
