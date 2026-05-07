import { ResourceForm } from "~/components/startup/resource-form";
import { SiteShell } from "~/components/startup/site-shell";

export default function NewResourcePage() {
	return (
		<SiteShell>
			<main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
				<h1 className="mb-8 font-semibold text-4xl tracking-normal">
					Create resource
				</h1>
				<div className="rounded-lg border bg-white p-6 shadow-sm">
					<ResourceForm />
				</div>
			</main>
		</SiteShell>
	);
}
