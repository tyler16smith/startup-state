import { CheckCircle2, Loader2, MapPin, Search, Sparkles } from "lucide-react";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";

const loadingSteps = [
	{
		label: "Reading thesis",
		description: "Stages, sectors, regions, and goals",
		icon: CheckCircle2,
		status: "complete",
	},
	{
		label: "Ranking companies",
		description: "Scoring startup fit and investor relevance",
		icon: Loader2,
		status: "active",
	},
	{
		label: "Preparing map",
		description: "Placing shortlist options with clear why notes",
		icon: Sparkles,
		status: "pending",
	},
];

const loadingCardIndexes = [0, 1, 2, 3];
const markerIndexes = [1, 2, 3, 4, 5];

export function InvestorResultsLoading() {
	return (
		<main
			aria-live="polite"
			className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8"
			role="status"
		>
			<section className="rounded-lg border bg-white p-5 shadow-sm">
				<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
					<div className="max-w-2xl">
						<div className="flex items-center gap-2 font-medium text-emerald-700 text-sm">
							<Search className="size-4" />
							Building your investor shortlist
						</div>
						<h2 className="mt-2 font-semibold text-2xl tracking-normal">
							Finding the strongest company matches
						</h2>
						<p className="mt-2 text-muted-foreground text-sm">
							Ranking Utah startups against your thesis and preparing the map
							view.
						</p>
					</div>
					<div className="min-w-0 rounded-lg border border-emerald-100 bg-emerald-50 p-4 lg:w-80">
						<div className="flex items-center justify-between gap-3 text-sm">
							<span className="font-medium text-emerald-950">
								Company match scan
							</span>
							<Loader2 className="size-4 animate-spin text-emerald-700" />
						</div>
						<Progress className="mt-3 bg-emerald-100" value={68} />
					</div>
				</div>
				<div className="mt-6 grid gap-3 md:grid-cols-3">
					{loadingSteps.map((step) => {
						const Icon = step.icon;
						const iconClassName =
							step.status === "active"
								? "size-4 animate-spin text-emerald-700"
								: "size-4 text-emerald-600";
						return (
							<div className="rounded-lg border bg-white p-3" key={step.label}>
								<div className="flex items-center gap-2 font-medium text-sm">
									<Icon className={iconClassName} />
									{step.label}
								</div>
								<p className="mt-1 text-muted-foreground text-xs">
									{step.description}
								</p>
							</div>
						);
					})}
				</div>
			</section>

			<section className="relative h-[680px] overflow-hidden rounded-xl border bg-slate-50 shadow-sm">
				<div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:56px_56px]" />
				<div className="absolute inset-0 bg-white/55" />
				<div className="absolute top-10 right-12 flex items-center gap-2 rounded-md bg-white/80 px-3 py-2 text-muted-foreground text-xs shadow-sm">
					<MapPin className="size-4 text-emerald-700" />
					<Skeleton className="h-3 w-28" />
				</div>
				{markerIndexes.map((markerIndex) => (
					<div
						className="absolute flex size-7 items-center justify-center rounded-full border-2 border-white bg-emerald-600 font-semibold text-white text-xs shadow-md"
						key={markerIndex}
						style={{
							left: `${36 + (markerIndex % 3) * 16}%`,
							top: `${28 + markerIndex * 8}%`,
						}}
					>
						{markerIndex}
					</div>
				))}

				<div className="absolute top-0 bottom-0 left-0 flex w-80 flex-col gap-3 overflow-hidden bg-white/95 p-3 shadow-lg backdrop-blur-sm">
					{loadingCardIndexes.map((cardIndex) => (
						<div
							className="rounded-lg border bg-white p-4 shadow-sm"
							key={cardIndex}
						>
							<div className="flex items-start justify-between gap-3">
								<Skeleton className="h-6 w-9 rounded-md bg-emerald-100" />
								<Skeleton className="h-6 w-16 rounded-md" />
							</div>
							<Skeleton className="mt-4 h-5 w-32" />
							<Skeleton className="mt-2 h-3 w-40" />
							<div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
								<Skeleton className="h-3 w-12 bg-emerald-100" />
								<Skeleton className="mt-3 h-3 w-full bg-emerald-100" />
								<Skeleton className="mt-2 h-3 w-5/6 bg-emerald-100" />
								<Skeleton className="mt-2 h-3 w-2/3 bg-emerald-100" />
							</div>
							<Skeleton className="mt-4 h-8 w-full rounded-md" />
						</div>
					))}
				</div>
			</section>
		</main>
	);
}
