import { ResourceDirectoryResults } from "~/components/startup/resource-directory-results";
import { getResourceTaxonomy, listResources } from "~/lib/startup-server-api";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function value(
	params: Record<string, string | string[] | undefined>,
	key: string,
) {
	const item = params[key];
	return Array.isArray(item) ? item[0] : item;
}

function values(
	params: Record<string, string | string[] | undefined>,
	key: string,
) {
	const item = params[key];
	if (!item) return [];
	return Array.isArray(item) ? item : [item];
}

export default async function ResourcesPage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const params = await searchParams;
	const selected = {
		q: value(params, "q"),
		community: values(params, "community"),
		industry: values(params, "industry"),
		location: values(params, "location"),
		topic: values(params, "topic"),
	};
	const [resources, taxonomy] = await Promise.all([
		listResources({
			q: value(params, "q"),
			community: selected.community,
			industry: selected.industry,
			location: selected.location,
			topic: selected.topic,
			businessType: value(params, "businessType"),
			sort: value(params, "sort") ?? "recent",
		}),
		getResourceTaxonomy(),
	]);

	return (
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
			<ResourceDirectoryResults
				resources={resources}
				selected={selected}
				taxonomy={taxonomy}
			/>
		</main>
	);
}
