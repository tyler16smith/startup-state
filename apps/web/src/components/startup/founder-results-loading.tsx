import { CheckCircle2, Loader2, Search, Sparkles } from "lucide-react";
import { Progress } from "~/components/ui/progress";
import { Skeleton } from "~/components/ui/skeleton";

const loadingSteps = [
	{
		label: "Reading intake",
		description: "Stage, goals, sector, and region",
		icon: CheckCircle2,
		status: "complete",
	},
	{
		label: "Ranking resources",
		description: "Matching taxonomy, keywords, and location fit",
		icon: Loader2,
		status: "active",
	},
	{
		label: "Preparing cards",
		description: "Writing clear reasons for each recommendation",
		icon: Sparkles,
		status: "pending",
	},
];

const loadingCardIndexes = [0, 1, 2];

export function FounderResultsLoading() {
	return (
		<div aria-live="polite" className="space-y-6" role="status">
			<section className="rounded-lg border bg-white p-5 shadow-sm">
				<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
					<div className="max-w-2xl">
						<div className="flex items-center gap-2 font-medium text-emerald-700 text-sm">
							<Search className="size-4" />
							Building your Utah startup action plan
						</div>
						<h2 className="mt-2 font-semibold text-2xl tracking-normal">
							Finding the strongest resource matches
						</h2>
						<p className="mt-2 text-muted-foreground text-sm">
							Scoring published resources against your founder profile and
							checking for the clearest next steps.
						</p>
					</div>
					<div className="min-w-0 rounded-lg border border-emerald-100 bg-emerald-50 p-4 lg:w-80">
						<div className="flex items-center justify-between gap-3 text-sm">
							<span className="font-medium text-emerald-950">
								Recommendation scan
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

			<div className="grid gap-5 lg:grid-cols-3">
				{loadingCardIndexes.map((cardIndex) => (
					<div
						className="rounded-lg border bg-white p-5 shadow-sm"
						key={cardIndex}
					>
						<div className="flex items-center gap-2">
							<Skeleton className="h-6 w-20 rounded-md" />
							<Skeleton className="h-6 w-16 rounded-md" />
						</div>
						<Skeleton className="mt-4 h-7 w-4/5" />
						<Skeleton className="mt-3 h-4 w-full" />
						<Skeleton className="mt-2 h-4 w-11/12" />
						<Skeleton className="mt-2 h-4 w-2/3" />
						<div className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
							<Skeleton className="h-4 w-40 bg-emerald-100" />
							<Skeleton className="mt-3 h-3 w-full bg-emerald-100" />
							<Skeleton className="mt-2 h-3 w-3/4 bg-emerald-100" />
						</div>
						<div className="mt-5 flex flex-wrap gap-2">
							<Skeleton className="h-6 w-24 rounded-md" />
							<Skeleton className="h-6 w-28 rounded-md" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
