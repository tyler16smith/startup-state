import { ClaimCompanyForm } from "~/components/startup/claim-company-form";
import { SiteShell } from "~/components/startup/site-shell";

export default async function ClaimCompanyPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	return (
		<SiteShell>
			<main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
				<ClaimCompanyForm companyId={id} />
			</main>
		</SiteShell>
	);
}
