import { FounderResults } from "~/components/startup/founder-results";

export default function FounderResultsPage() {
	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<h1 className="sr-only">Founder resource recommendations</h1>
			<FounderResults />
		</main>
	);
}
