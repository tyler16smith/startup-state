import { CompanyForm } from "~/components/startup/company-form";
import { SiteShell } from "~/components/startup/site-shell";

export default function AdminNewCompanyPage() {
	return (
		<SiteShell>
			<main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
				<h1 className="mb-8 font-semibold text-4xl tracking-normal">
					Create company
				</h1>
				<div className="rounded-lg border bg-white p-6 shadow-sm">
					<CompanyForm admin />
				</div>
			</main>
		</SiteShell>
	);
}
