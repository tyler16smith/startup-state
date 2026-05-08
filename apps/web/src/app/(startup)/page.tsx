import {
	ArrowRight,
	Building2,
	Compass,
	DatabaseZap,
	Map as MapIcon,
	Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";

const productHighlights = [
	{
		icon: Compass,
		title: "Founder Navigator",
		description:
			"Answer a short intake and get ranked resources with clear reasons.",
	},
	{
		icon: MapIcon,
		title: "Utah Startup Map",
		description:
			"Explore companies by sector, size, hiring status, and location.",
	},
	{
		icon: DatabaseZap,
		title: "Admin-updatable content",
		description: "Resources and company listings update without redeployment.",
	},
];

const proofPoints = [
	{
		icon: Sparkles,
		title: "Resource discovery in under two minutes",
		description:
			"Structured metadata powers reliable recommendations before any AI enhancement is needed.",
	},
	{
		icon: Building2,
		title: "Rich company profiles",
		description:
			"Profiles include location, hiring, jobs, photos, ownership claims, and ecosystem context.",
	},
	{
		icon: MapIcon,
		title: "Investor-ready map",
		description:
			"A Utah-centered map and fallback list view make the ecosystem easy to explore live.",
	},
];

export default function Home() {
	return (
		<main>
			<section className="border-slate-200 border-b bg-white">
				<div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
					<div>
						<p className="font-medium text-emerald-700 text-sm">
							Utah Governor's Office of Economic Development hackathon
						</p>
						<h1 className="mt-4 max-w-3xl font-semibold text-5xl tracking-normal sm:text-6xl">
							The official operating system for building in Utah.
						</h1>
						<p className="mt-6 max-w-2xl text-lg text-muted-foreground">
							Startup State Navigator gives founders fast, personalized state
							resource guidance and gives investors a living map of Utah's
							startup economy.
						</p>
						<div className="mt-8 grid gap-3 sm:grid-cols-2">
							<Button asChild className="h-12 justify-between" size="lg">
								<Link href="/founder">
									I'm building a company <ArrowRight className="size-4" />
								</Link>
							</Button>
							<Button
								asChild
								className="h-12 justify-between"
								size="lg"
								variant="outline"
							>
								<Link href="/map">
									Explore Utah's ecosystem <MapIcon className="size-4" />
								</Link>
							</Button>
						</div>
					</div>
					<div className="rounded-lg border bg-[#f8faf9] p-4 shadow-sm">
						<div className="grid gap-3">
							{productHighlights.map(({ icon: Icon, title, description }) => (
								<div className="rounded-lg border bg-white p-5" key={title}>
									<div className="flex items-start gap-3">
										<div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
											<Icon className="size-5" />
										</div>
										<div>
											<h2 className="font-semibold">{title}</h2>
											<p className="mt-1 text-muted-foreground text-sm">
												{description}
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>
			<section className="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
				{proofPoints.map(({ icon: Icon, title, description }) => (
					<div className="rounded-lg border bg-white p-6 shadow-sm" key={title}>
						<Icon className="size-5 text-emerald-700" />
						<h2 className="mt-4 font-semibold text-xl">{title}</h2>
						<p className="mt-2 text-muted-foreground text-sm">{description}</p>
					</div>
				))}
			</section>
		</main>
	);
}
