import { ResourceForm } from "~/components/startup/resource-form";
import { getResourceTaxonomy } from "~/lib/startup-server-api";

export default async function NewResourcePage() {
	const taxonomy = await getResourceTaxonomy();

	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<h1 className="mb-8 font-semibold text-4xl tracking-normal">
				Create resource
			</h1>
			<ResourceForm showPreview taxonomy={taxonomy} />
		</main>
	);
}
