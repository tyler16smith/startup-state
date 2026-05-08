"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "~/components/startup/empty-state";
import { ResourceCard } from "~/components/startup/resource-card";
import {
	ResourceFilterPanel,
	type ResourceFilterSelection,
} from "~/components/startup/resource-filter-panel";
import type { Paginated, Resource, ResourceTaxonomy } from "~/lib/startup-api";

export function ResourceDirectoryResults({
	resources,
	selected,
	taxonomy,
}: {
	resources: Paginated<Resource>;
	selected: ResourceFilterSelection;
	taxonomy: ResourceTaxonomy;
}) {
	const [isUpdating, setIsUpdating] = useState(false);
	const resultCount = resources.items.length;

	return (
		<>
			<ResourceFilterPanel
				onPendingChange={setIsUpdating}
				selected={selected}
				taxonomy={taxonomy}
			/>
			<section
				aria-busy={isUpdating}
				aria-label="Resource results"
				className="relative"
			>
				<p className="sr-only" role="status">
					{isUpdating
						? "Updating resource results."
						: `${resultCount} ${resultCount === 1 ? "resource" : "resources"} found.`}
				</p>
				{resources.items.length ? (
					<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
						{resources.items.map((resource) => (
							<ResourceCard key={resource.id} resource={resource} />
						))}
					</div>
				) : (
					<EmptyState
						description="Try removing a filter or importing resources from the admin panel."
						icon={Sparkles}
						title="No resources match these filters yet"
					/>
				)}
				{isUpdating && (
					<div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-gray-50/80 px-4 py-12 shadow-inner">
						<div
							aria-live="polite"
							className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 font-medium text-slate-700 text-sm shadow-sm"
							role="status"
						>
							<Loader2 className="size-4 animate-spin" />
							Updating results
						</div>
					</div>
				)}
			</section>
		</>
	);
}
