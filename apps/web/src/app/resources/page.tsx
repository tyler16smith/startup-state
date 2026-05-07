import { Search, Sparkles } from "lucide-react";
import { EmptyState } from "~/components/startup/empty-state";
import { ResourceCard } from "~/components/startup/resource-card";
import { SiteShell } from "~/components/startup/site-shell";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { listResources } from "~/lib/startup-server-api";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function value(
	params: Record<string, string | string[] | undefined>,
	key: string,
) {
	const item = params[key];
	return Array.isArray(item) ? item[0] : item;
}

export default async function ResourcesPage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const params = await searchParams;
	const resources = await listResources({
		q: value(params, "q"),
		stage: value(params, "stage"),
		sector: value(params, "sector"),
		goal: value(params, "goal"),
		region: value(params, "region"),
		businessType: value(params, "businessType"),
		sort: value(params, "sort") ?? "recent",
	});

	return (
		<SiteShell>
			<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
				<div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
					<div>
						<p className="font-medium text-emerald-700 text-sm">
							Resource directory
						</p>
						<h1 className="mt-2 font-semibold text-4xl tracking-normal">
							Utah startup resources
						</h1>
						<p className="mt-3 max-w-2xl text-muted-foreground">
							Search and filter state, regional, capital, mentorship, education,
							and support programs.
						</p>
					</div>
				</div>
				<form className="mb-6 grid gap-3 rounded-lg border bg-white p-4 shadow-sm md:grid-cols-[1.5fr_repeat(4,1fr)_auto]">
					<div className="relative">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="pl-9"
							defaultValue={value(params, "q") ?? ""}
							name="q"
							placeholder="Search resources"
						/>
					</div>
					<Input
						defaultValue={value(params, "stage") ?? ""}
						name="stage"
						placeholder="Stage"
					/>
					<Input
						defaultValue={value(params, "sector") ?? ""}
						name="sector"
						placeholder="Sector"
					/>
					<Input
						defaultValue={value(params, "goal") ?? ""}
						name="goal"
						placeholder="Goal"
					/>
					<Input
						defaultValue={value(params, "region") ?? ""}
						name="region"
						placeholder="Region"
					/>
					<Button type="submit">Filter</Button>
				</form>
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
			</main>
		</SiteShell>
	);
}
