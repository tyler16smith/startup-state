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
			<h1 className="mb-8 font-semibold text-4xl tracking-normal">
				Create company
			</h1>
			<CompanyForm admin showPreview />
		</main>
	);
}
