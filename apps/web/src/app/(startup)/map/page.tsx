import { CompanyMap } from "~/components/startup/company-map";

export default function MapPage() {
	return (
		<main className="h-full min-h-0">
			<CompanyMap token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />
		</main>
	);
}
