import { CompanyMap } from "~/components/startup/company-map";

export default function MapPage() {
	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<div className="mb-8 max-w-3xl">
				<p className="font-medium text-emerald-700 text-sm">Utah Startup Map</p>
				<h1 className="mt-2 font-semibold text-4xl tracking-normal">
					Explore Utah's startup economy.
				</h1>
				<p className="mt-3 text-muted-foreground">
					Filter companies by sector, hiring signal, stage, size, and location.
					Click a marker to open a rich profile.
				</p>
			</div>
			<CompanyMap token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />
		</main>
	);
}
