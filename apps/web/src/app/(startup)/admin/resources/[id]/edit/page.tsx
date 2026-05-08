import { notFound } from "next/navigation";
import { PageBreadcrumb } from "~/components/startup/page-breadcrumb";
import { ResourceForm } from "~/components/startup/resource-form";
import type { Resource } from "~/lib/startup-api";
import { apiServer, getResourceTaxonomy } from "~/lib/startup-server-api";

export default async function EditResourcePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	let resource: Resource;
	const taxonomy = await getResourceTaxonomy();
	try {
		resource = await apiServer<Resource>("/api/v1/resources/adminGet", { id });
	} catch {
		notFound();
	}
	return (
		<main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
			<PageBreadcrumb
				items={[
					{ label: "Admin", href: "/admin" },
					{ label: "Resources", href: "/admin/resources" },
					{ label: "Edit resource" },
				]}
			/>
			<h1 className="mb-8 font-semibold text-4xl tracking-normal">
				Edit resource
			</h1>
			<div className="rounded-lg border bg-white p-6 shadow-sm">
				<ResourceForm resource={resource} taxonomy={taxonomy} />
			</div>
		</main>
	);
}
