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
import type { Resource } from "~/lib/startup-api";

function resourceAddress(resource: Resource) {
	return [resource.city, resource.county, resource.state]
		.filter(Boolean)
		.join(", ");
}

export function AdminResourcesTable({ resources }: { resources: Resource[] }) {
	const [query, setQuery] = useState("");
	const filteredResources = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) return resources;
		return resources.filter((resource) =>
			resource.name.toLowerCase().includes(normalizedQuery),
		);
	}, [resources, query]);

	return (
		<section className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative w-full sm:max-w-sm">
					<Search
						aria-hidden="true"
						className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
					/>
					<Input
						aria-label="Search resource names"
						className="pl-9"
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search resource names"
						value={query}
					/>
				</div>
				<p className="text-muted-foreground text-sm">
					{filteredResources.length} of {resources.length} resources
				</p>
			</div>
			<div className="rounded-lg border bg-white p-4 shadow-sm">
				<Table>
					<TableCaption>Resources awaiting admin management</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Category</TableHead>
							<TableHead>Address</TableHead>
							<TableHead>Source ID</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredResources.map((resource) => {
							const address = resourceAddress(resource);
							return (
								<TableRow key={resource.id}>
									<TableCell className="max-w-[14rem] font-medium">
										<span className="block truncate" title={resource.name}>
											{resource.name}
										</span>
									</TableCell>
									<TableCell>{resource.status}</TableCell>
									<TableCell>{resource.category ?? "-"}</TableCell>
									<TableCell className="max-w-[18rem]">
										<span className="block truncate" title={address || undefined}>
											{address || "-"}
										</span>
									</TableCell>
									<TableCell>{resource.sourceId ?? "-"}</TableCell>
									<TableCell className="text-right">
										<Button asChild size="sm" variant="outline">
											<Link
												aria-label={`Edit ${resource.name}`}
												href={`/admin/resources/${resource.id}/edit`}
											>
												Edit
											</Link>
										</Button>
									</TableCell>
								</TableRow>
							);
						})}
						{filteredResources.length === 0 && (
							<TableRow>
								<TableCell
									className="h-24 text-center text-muted-foreground"
									colSpan={6}
								>
									No resources match your search.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}
