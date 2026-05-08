import { CompanyForm } from "~/components/startup/company-form";

export default function NewCompanyPage() {
	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<div className="mb-8">
				<p className="font-medium text-emerald-700 text-sm">
					Company submission
				</p>
				<h1 className="mt-2 font-semibold text-4xl tracking-normal">
					Add a Utah company listing.
				</h1>
				<p className="mt-3 text-muted-foreground">
					Authenticated users can submit a listing for review. Admins can
					publish it when the details are verified.
				</p>
			</div>
			<CompanyForm mode="submission" showPreview />
		</main>
	);
}
