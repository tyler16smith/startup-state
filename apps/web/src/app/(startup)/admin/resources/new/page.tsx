import { AdminCreatePageHeader } from "~/components/startup/admin-create-page-header";
import { CsvImportDropZone } from "~/components/startup/csv-import-drop-zone";
import { PageBreadcrumb } from "~/components/startup/page-breadcrumb";
import { ResourceForm } from "~/components/startup/resource-form";
import { getResourceTaxonomy } from "~/lib/startup-server-api";

export default async function NewResourcePage() {
	const taxonomy = await getResourceTaxonomy();

	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<PageBreadcrumb
				items={[
					{ label: "Admin", href: "/admin" },
					{ label: "Resources", href: "/admin/resources" },
					{ label: "Create resource" },
				]}
			/>
			<AdminCreatePageHeader
				endpoint="/api/v1/resources/import"
				inputId="resource-csv-import-drop-zone"
				title="Create resource"
				uploadTitle="Upload resources CSV"
			/>
			<ResourceForm showPreview taxonomy={taxonomy} />
		</main>
	);
}
