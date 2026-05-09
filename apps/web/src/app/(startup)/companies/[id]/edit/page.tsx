import { notFound, redirect } from "next/navigation";
import { CompanyForm } from "~/components/startup/company-form";
import { PageBreadcrumb } from "~/components/startup/page-breadcrumb";
import type { Company } from "~/lib/startup-api";
import { getEditableCompany } from "~/lib/startup-server-api";
import { auth } from "~/server/auth";

export default async function EditCompanyPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const session = await auth();
	if (!session?.user)
		redirect(`/auth/signin?callbackUrl=/companies/${id}/edit`);

	let company: Company;
	try {
		company = await getEditableCompany(id);
	} catch {
		notFound();
	}

	return (
		<main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
			<PageBreadcrumb
				items={[
					{ label: "My companies", href: "/my-companies" },
					{ label: "Edit company" },
				]}
			/>
			<div className="mb-8">
				<p className="font-medium text-emerald-700 text-sm">Company profile</p>
				<h1 className="mt-2 font-semibold text-4xl tracking-normal">
					Edit {company.name}
				</h1>
			</div>
			<div className="rounded-lg border bg-white p-6 shadow-sm">
				<CompanyForm company={company} />
			</div>
		</main>
	);
}
