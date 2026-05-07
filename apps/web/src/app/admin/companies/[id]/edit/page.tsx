import { notFound } from "next/navigation";
import { CompanyForm } from "~/components/startup/company-form";
import { SiteShell } from "~/components/startup/site-shell";
import type { Company } from "~/lib/startup-api";
import { apiServer } from "~/lib/startup-server-api";

export default async function AdminEditCompanyPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	let company: Company;
	try {
		company = await apiServer<Company>("/api/v1/companies/adminGet", { id });
	} catch {
		notFound();
	}
	return (
		<SiteShell>
			<main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
				<h1 className="mb-8 font-semibold text-4xl tracking-normal">
					Edit company
				</h1>
				<div className="rounded-lg border bg-white p-6 shadow-sm">
					<CompanyForm admin company={company} />
				</div>
			</main>
		</SiteShell>
	);
}
