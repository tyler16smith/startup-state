"use client";

import { ArrowRight, Building2, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "~/components/startup/empty-state";
import { SavePlanDialog } from "~/components/startup/navigator-flow/save-plan-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	apiClient,
	type InvestorCompanyRecommendation,
	type InvestorProfileInput,
} from "~/lib/startup-api";

export function InvestorResults() {
	const { data: session, status } = useSession();
	const [profile, setProfile] = useState<InvestorProfileInput | null>(null);
	const [recommendations, setRecommendations] = useState<
		InvestorCompanyRecommendation[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const autoSaveAttempted = useRef(false);

	useEffect(() => {
		const raw = sessionStorage.getItem("startup-investor-intake");
		if (!raw) {
			setLoading(false);
			return;
		}
		const input = JSON.parse(raw) as InvestorProfileInput;
		setProfile(input);
		apiClient<{ recommendations: InvestorCompanyRecommendation[] }>(
			"/api/v1/companies/recommend",
			{
				method: "POST",
				body: JSON.stringify(input),
			},
		)
			.then((data) => {
				setRecommendations(data.recommendations);
				sessionStorage.setItem(
					"startup-investor-result",
					JSON.stringify({ recommendations: data.recommendations }),
				);
			})
			.catch((err: unknown) =>
				setError(
					err instanceof Error ? err.message : "Could not load recommendations",
				),
			)
			.finally(() => setLoading(false));
	}, []);

	const savePlan = useCallback(async () => {
		if (!profile || recommendations.length === 0) return;
		if (!session?.user) {
			setSaveDialogOpen(true);
			return;
		}
		setSaving(true);
		setSaveError(null);
		try {
			await apiClient("/api/v1/navigatorPlans/save", {
				method: "POST",
				body: JSON.stringify({
					kind: "INVESTOR",
					title: "Investor shortlist",
					input: profile,
					result: { recommendations },
				}),
			});
			setSaved(true);
			window.history.replaceState(null, "", "/investor/results");
		} catch (err) {
			setSaveError(
				err instanceof Error ? err.message : "Could not save this result",
			);
		} finally {
			setSaving(false);
		}
	}, [profile, recommendations, session?.user]);

	useEffect(() => {
		if (
			autoSaveAttempted.current ||
			status === "loading" ||
			!session?.user ||
			loading ||
			error ||
			recommendations.length === 0
		) {
			return;
		}
		const shouldSave = new URLSearchParams(window.location.search).get("save");
		if (shouldSave !== "1") return;
		autoSaveAttempted.current = true;
		void savePlan();
	}, [error, loading, recommendations.length, session?.user, status, savePlan]);

	if (loading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-white px-4 py-20">
				<div className="flex items-center gap-3 text-muted-foreground">
					<Loader2 className="size-5 animate-spin" /> Loading up your investor
					recommendations
				</div>
			</div>
		);
	}

	if (!profile) {
		return (
			<main className="mx-auto max-w-3xl px-4 py-20">
				<EmptyState
					description="Complete the investor navigator first so companies can be ranked against your thesis."
					icon={Building2}
					title="No investor filters found"
				/>
			</main>
		);
	}

	if (error) {
		return (
			<main className="mx-auto max-w-3xl px-4 py-20">
				<EmptyState
					description={error}
					icon={Building2}
					title="Could not rank companies"
				/>
			</main>
		);
	}

	return (
		<main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
			<div className="rounded-lg border bg-white p-5 shadow-sm">
				<div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
					<div>
						<p className="font-medium text-emerald-700 text-sm">
							Investor shortlist
						</p>
						<h1 className="mt-1 font-semibold text-2xl tracking-normal">
							Five Utah companies to research next
						</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							Filtered by your stage, sector, and advanced preferences, then
							ranked with concise fit reasoning.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button disabled={saving || saved} onClick={savePlan}>
							{saving ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Save className="size-4" />
							)}
							{saved ? "Saved" : "Save result"}
						</Button>
						<Button asChild variant="outline">
							<Link href="/map">
								View map <ArrowRight className="size-4" />
							</Link>
						</Button>
					</div>
				</div>
			</div>
			<SavePlanDialog
				callbackUrl="/investor/results?save=1"
				onOpenChange={setSaveDialogOpen}
				open={saveDialogOpen}
			/>
			{saveError && <p className="text-destructive text-sm">{saveError}</p>}
			{recommendations.length ? (
				<div className="grid gap-5 lg:grid-cols-5">
					{recommendations.map((recommendation) => (
						<article
							className="flex h-full flex-col rounded-lg border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
							key={recommendation.company.id}
						>
							<div className="flex items-start justify-between gap-3">
								<Badge className="rounded-md bg-emerald-600 text-white">
									#{recommendation.rank}
								</Badge>
								{typeof recommendation.score === "number" && (
									<Badge className="rounded-md" variant="secondary">
										{recommendation.score} fit
									</Badge>
								)}
							</div>
							<h2 className="mt-4 font-semibold text-lg leading-tight">
								{recommendation.company.name}
							</h2>
							<p className="mt-2 text-muted-foreground text-sm">
								{recommendation.company.sector ?? "Utah startup"}
								{recommendation.company.stage
									? ` · ${recommendation.company.stage.replace(/_/g, " ").toLowerCase()}`
									: ""}
							</p>
							<p className="mt-4 text-sm leading-relaxed">
								{recommendation.why}
							</p>
							<Button
								asChild
								className="mt-auto w-full"
								size="sm"
								variant="outline"
							>
								<Link href={`/companies/${recommendation.company.id}`}>
									Open profile <ArrowRight className="size-4" />
								</Link>
							</Button>
						</article>
					))}
				</div>
			) : (
				<EmptyState
					description="No companies matched these filters yet. Try broadening stage or sector."
					icon={Building2}
					title="No shortlist yet"
				/>
			)}
		</main>
	);
}
