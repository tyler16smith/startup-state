import { ArrowRight, Building2, Compass } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "~/components/startup/empty-state";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type {
	InvestorCompanyRecommendation,
	ResourceRecommendation,
} from "~/lib/startup-api";
import { getLatestNavigatorPlan } from "~/lib/startup-server-api";
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

export default async function PlanPage() {
	const session = await auth();
	if (!session?.user) redirect("/auth/signin?callbackUrl=/plan");

	const plan = await getLatestNavigatorPlan();

	if (!plan) {
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

	const isFounder = plan.kind === "FOUNDER";
	const founderItems = isFounder ? founderRecommendations(plan.result) : [];
	const investorItems = !isFounder ? investorRecommendations(plan.result) : [];

	return (
		<main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
			<div className="rounded-lg border bg-white p-6 shadow-sm">
				<div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
					<div>
						<p className="font-medium text-emerald-700 text-sm">
							Your saved navigator homepage
						</p>
						<h1 className="mt-1 font-semibold text-3xl tracking-normal">
							{plan.title ??
								(isFounder ? "Founder action plan" : "Investor shortlist")}
						</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							This is your most recently saved Startup State result.
						</p>
					</div>
					<div className="flex gap-2">
						<Button asChild variant="outline">
							<Link href={isFounder ? "/founder" : "/investor"}>
								Run again <ArrowRight className="size-4" />
							</Link>
						</Button>
					</div>
				</div>
			</div>

			{isFounder ? (
				<div className="grid gap-5 lg:grid-cols-3">
					{founderItems.slice(0, 9).map((item) => (
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
							<h2 className="mt-4 truncate font-semibold text-xl leading-tight">
								{item.resource.name}
							</h2>
							<p className="mt-3 line-clamp-3 text-muted-foreground text-sm">
								{item.resource.shortDescription || item.resource.description}
							</p>
							{item.reasons.length > 0 && (
								<p className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-emerald-950 text-sm">
									{item.reasons[0]}
								</p>
							)}
							<Button asChild className="mt-5" size="sm" variant="outline">
								<Link href={`/resources/${item.resource.id}`}>
									Open resource
								</Link>
							</Button>
						</article>
					))}
				</div>
			) : (
				<div className="grid gap-5 lg:grid-cols-5">
					{investorItems.map((item) => (
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
							<h2 className="mt-4 truncate font-semibold text-lg leading-tight">
								{item.company.name}
							</h2>
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
			)}
		</main>
	);
}
