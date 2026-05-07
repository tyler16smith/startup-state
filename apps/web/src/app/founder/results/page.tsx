import { FounderResults } from "~/components/startup/founder-results";
import { SiteShell } from "~/components/startup/site-shell";

export default function FounderResultsPage() {
	return (
		<SiteShell>
			<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
				<FounderResults />
			</main>
		</SiteShell>
	);
}
