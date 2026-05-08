import { AdminCreatePageHeader } from "~/components/startup/admin-create-page-header";
import { CompanyForm } from "~/components/startup/company-form";
import { PageBreadcrumb } from "~/components/startup/page-breadcrumb";

export default function AdminNewCompanyPage() {
	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<PageBreadcrumb
				items={[
					{ label: "Admin", href: "/admin" },
					{ label: "Companies", href: "/admin/companies" },
					{ label: "Create company" },
				]}
			/>
			<AdminCreatePageHeader
				endpoint="/api/v1/companies/import"
				inputId="company-csv-import-drop-zone"
				title="Create company"
				uploadTitle="Upload companies CSV"
			/>
			<CompanyForm admin showPreview />
		</main>
	);
}
