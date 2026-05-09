import { ArrowRight, Building2, CalendarDays, Compass } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "~/components/startup/empty-state";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type {
	InvestorCompanyRecommendation,
	NavigatorPlan,
	ResourceRecommendation,
} from "~/lib/startup-api";
import { listNavigatorPlans } from "~/lib/startup-server-api";
import { auth } from "~/server/auth";

function founderRecommendations(value: unknown): ResourceRecommendation[] {
	if (typeof value !== "object" || value === null) return [];
	const recommendations = (value as { recommendations?: unknown })
		.recommendations;
	return Array.isArray(recommendations)
		? (recommendations as ResourceRecommendation[])
		: [];
}

function investorRecommendations(
	value: unknown,
): InvestorCompanyRecommendation[] {
	if (typeof value !== "object" || value === null) return [];
	const recommendations = (value as { recommendations?: unknown })
		.recommendations;
	return Array.isArray(recommendations)
		? (recommendations as InvestorCompanyRecommendation[])
		: [];
}

function formattedRunDate(value: string) {
	return new Intl.DateTimeFormat("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}

function planTitle(plan: NavigatorPlan) {
	return (
		plan.title ??
		(plan.kind === "FOUNDER" ? "Founder action plan" : "Investor shortlist")
	);
}

function planKindLabel(plan: NavigatorPlan) {
	return plan.kind === "FOUNDER" ? "Founder run" : "Investor run";
}

function FounderPlanGrid({ items }: { items: ResourceRecommendation[] }) {
	return (
		<div className="grid gap-5 lg:grid-cols-3">
			{items.slice(0, 9).map((item) => (
				<article
					className="rounded-lg border bg-white p-5 shadow-sm"
					key={item.resource.id}
				>
					<div className="flex items-center gap-2">
						<Badge className="rounded-md bg-emerald-600 text-white">
							{item.score} match
						</Badge>
						{item.resource.category && (
							<Badge className="rounded-md" variant="secondary">
								{item.resource.category}
							</Badge>
						)}
					</div>
					<h3 className="mt-4 truncate font-semibold text-xl leading-tight">
						{item.resource.name}
					</h3>
					<p className="mt-3 line-clamp-3 text-muted-foreground text-sm">
						{item.resource.shortDescription || item.resource.description}
					</p>
					{item.reasons.length > 0 && (
						<p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-emerald-950 text-sm">
							{item.reasons[0]}
						</p>
					)}
					<Button asChild className="mt-5" size="sm" variant="outline">
						<Link href={`/resources/${item.resource.id}`}>Open resource</Link>
					</Button>
				</article>
			))}
		</div>
	);
}

function InvestorPlanGrid({
	items,
}: {
	items: InvestorCompanyRecommendation[];
}) {
	return (
		<div className="grid gap-5 lg:grid-cols-5">
			{items.map((item) => (
				<article
					className="rounded-lg border bg-white p-5 shadow-sm"
					key={item.company.id}
				>
					<div className="flex items-center justify-between gap-2">
						<Badge className="rounded-md bg-emerald-600 text-white">
							#{item.rank}
						</Badge>
						<Building2 className="size-4 text-muted-foreground" />
					</div>
					<h3 className="mt-4 truncate font-semibold text-lg leading-tight">
						{item.company.name}
					</h3>
					<p className="mt-2 text-muted-foreground text-sm">
						{item.company.sector ?? "Utah startup"}
					</p>
					<p className="mt-4 text-sm leading-relaxed">{item.why}</p>
					<Button asChild className="mt-5" size="sm" variant="outline">
						<Link href={`/companies/${item.company.id}`}>Open profile</Link>
					</Button>
				</article>
			))}
		</div>
	);
}

function PlanRecommendations({ plan }: { plan: NavigatorPlan }) {
	const isFounder = plan.kind === "FOUNDER";
	const founderItems = isFounder ? founderRecommendations(plan.result) : [];
	const investorItems = !isFounder ? investorRecommendations(plan.result) : [];

	return isFounder ? (
		<FounderPlanGrid items={founderItems} />
	) : (
		<InvestorPlanGrid items={investorItems} />
	);
}

function PlanRun({ plan }: { plan: NavigatorPlan }) {
	const isFounder = plan.kind === "FOUNDER";

	return (
		<section className="space-y-5 rounded-lg border bg-white p-6 shadow-sm">
			<div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
				<div>
					<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
						<Badge className="rounded-md" variant="secondary">
							{planKindLabel(plan)}
						</Badge>
						<span className="inline-flex items-center gap-1">
							<CalendarDays className="size-4" />
							{formattedRunDate(plan.createdAt)}
						</span>
					</div>
					<h2 className="mt-3 font-semibold text-2xl tracking-normal">
						{planTitle(plan)}
					</h2>
				</div>
				<Button asChild variant="outline">
					<Link href={isFounder ? "/founder" : "/investor"}>
						Run again <ArrowRight className="size-4" />
					</Link>
				</Button>
			</div>

			<PlanRecommendations plan={plan} />
		</section>
	);
}

export default async function PlanPage() {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin?callbackUrl=/plan");

	const plans = await listNavigatorPlans();

	if (plans.length === 0) {
		return (
			<main className="mx-auto flex min-h-full max-w-4xl items-center px-4 py-10 sm:px-6 lg:px-8">
				<EmptyState
					description="Create a founder action plan or investor shortlist, then save it to make it your homepage."
					icon={Compass}
					title="No saved plan yet"
				/>
				<div className="mt-6 flex gap-2">
					<Button asChild>
						<Link href="/founder">Start founder flow</Link>
					</Button>
					<Button asChild variant="outline">
						<Link href="/investor">Start investor flow</Link>
					</Button>
				</div>
			</main>
		);
	}

	const onlyPlan = plans.length === 1 ? plans[0] : undefined;

	return (
		<main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
			<div className="rounded-lg border bg-white p-6 shadow-sm">
				<div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
					<div>
						<p className="font-medium text-emerald-700 text-sm">
							{onlyPlan
								? "Your saved navigator homepage"
								: "Your saved navigator runs"}
						</p>
						<h1 className="mt-1 font-semibold text-3xl tracking-normal">
							{onlyPlan ? planTitle(onlyPlan) : "Past Startup State runs"}
						</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							{onlyPlan
								? "This is your saved Startup State result."
								: `Showing ${plans.length} saved Startup State runs.`}
						</p>
					</div>
					<div className="flex gap-2">
						{onlyPlan ? (
							<Button asChild variant="outline">
								<Link
									href={onlyPlan.kind === "FOUNDER" ? "/founder" : "/investor"}
								>
									Run again <ArrowRight className="size-4" />
								</Link>
							</Button>
						) : (
							<>
								<Button asChild variant="outline">
									<Link href="/founder">Founder run</Link>
								</Button>
								<Button asChild variant="outline">
									<Link href="/investor">Investor run</Link>
								</Button>
							</>
						)}
					</div>
				</div>
			</div>

			{onlyPlan ? (
				<PlanRecommendations plan={onlyPlan} />
			) : (
				<div className="space-y-8">
					{plans.map((plan) => (
						<PlanRun key={plan.id} plan={plan} />
					))}
				</div>
			)}
		</main>
	);
}
