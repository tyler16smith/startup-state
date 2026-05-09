import { notFound } from "next/navigation";
import { CompanyProfileContent } from "~/components/startup/company-profile-content";
import type { Company } from "~/lib/startup-api";
import { getCompany } from "~/lib/startup-server-api";

export default async function CompanyProfilePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	let company: Company;
	try {
		company = await getCompany(id);
	} catch {
		notFound();
	}
	const mapToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<CompanyProfileContent company={company} mapToken={mapToken} />
		</main>
	);
}
