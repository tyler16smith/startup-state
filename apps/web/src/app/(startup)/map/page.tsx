import { CompanyMap } from "~/components/startup/company-map";

export default function MapPage() {
	return (
		<main className="h-full min-h-0">
			<h1 className="sr-only">Utah company map</h1>
			<CompanyMap token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />
		</main>
	);
}
