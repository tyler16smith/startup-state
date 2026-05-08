"use client";

import confetti from "canvas-confetti";
import {
	ArrowRight,
	Compass,
	Loader2,
	Map as MapIcon,
	Save,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmptyState } from "~/components/startup/empty-state";
import { FounderResultsLoading } from "~/components/startup/founder-results-loading";
import {
	cachedRecommendationsForProfile,
	FOUNDER_INTAKE_KEY,
	FOUNDER_RESULT_KEY,
	normalizeFounderProfile,
	normalizeRecommendations,
	readStorageJson,
} from "~/components/startup/founder-results-utils";
import { SavePlanDialog } from "~/components/startup/navigator-flow/save-plan-dialog";
import { ResourceCard } from "~/components/startup/resource-card";
import { Button } from "~/components/ui/button";
import {
	apiClient,
	type FounderProfileInput,
	type ResourceRecommendation,
} from "~/lib/startup-api";

export function FounderResults() {
	const { data: session, status } = useSession();
	const [recommendations, setRecommendations] = useState<
		ResourceRecommendation[]
	>([]);
	const [profile, setProfile] = useState<FounderProfileInput | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const celebrated = useRef(false);
	const autoSaveAttempted = useRef(false);

	useEffect(() => {
		const input = normalizeFounderProfile(readStorageJson(FOUNDER_INTAKE_KEY));
		if (!input) {
			setLoading(false);
			return;
		}
		setProfile(input);

		const cachedRecommendations = cachedRecommendationsForProfile(input);
		if (cachedRecommendations) {
			setRecommendations(cachedRecommendations);
			setLoading(false);
			return;
		}

		apiClient<{ recommendations: ResourceRecommendation[] }>(
			"/api/v1/resources/recommend",
			{
				method: "POST",
				body: JSON.stringify(input),
			},
		)
			.then((data) => {
				const nextRecommendations = normalizeRecommendations(
					data.recommendations,
				);
				setRecommendations(nextRecommendations);
				sessionStorage.setItem(
					FOUNDER_RESULT_KEY,
					JSON.stringify({
						profile: input,
						recommendations: nextRecommendations,
					}),
				);
			})
			.catch((err: unknown) =>
				setError(
					err instanceof Error ? err.message : "Could not load recommendations",
				),
			)
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		if (
			loading ||
			error ||
			recommendations.length === 0 ||
			celebrated.current
		) {
			return;
		}
		celebrated.current = true;
		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reducedMotion) return;
		const shared = { particleCount: 70, spread: 70, ticks: 220 };
		void confetti({ ...shared, origin: { x: 0, y: 0.72 }, angle: 60 });
		void confetti({ ...shared, origin: { x: 1, y: 0.72 }, angle: 120 });
	}, [error, loading, recommendations.length]);

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
					kind: "FOUNDER",
					title: "Founder action plan",
					input: profile,
					result: { recommendations },
				}),
			});
			setSaved(true);
			window.history.replaceState(null, "", "/founder/results");
		} catch (err) {
			setSaveError(
				err instanceof Error ? err.message : "Could not save this plan",
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
		return <FounderResultsLoading />;
	}

	if (!profile) {
		return (
			<EmptyState
				description="Complete the founder intake first so recommendations can be ranked against your stage, goals, sector, and region."
				icon={Compass}
				title="No intake found"
			/>
		);
	}

	if (error) {
		return (
			<EmptyState
				description={error}
				icon={Compass}
				title="Recommendations could not load"
			/>
		);
	}

	return (
		<div className="space-y-8">
			<div className="rounded-lg border bg-white p-5 shadow-sm">
				<div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
					<div>
						<p className="font-medium text-emerald-700 text-sm">
							Your plan is ready!
						</p>
						<h2 className="mt-1 font-semibold text-2xl">
							Top resources for a{" "}
							{profile.stage?.replace(/_/g, " ").toLowerCase()} founder in{" "}
							{profile.region}
						</h2>
						<p className="mt-2 text-muted-foreground text-sm">
							Ranked by stage fit, goals, sector, location, business type, and
							keyword relevance.
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button disabled={saving || saved} onClick={savePlan}>
							{saving ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Save className="size-4" />
							)}
							{saved ? "Saved" : "Save my plan"}
						</Button>
						<Button asChild variant="outline">
							<Link href="/resources">
								Browse all <ArrowRight className="size-4" />
							</Link>
						</Button>
						<Button asChild>
							<Link href="/map">
								View map <MapIcon className="size-4" />
							</Link>
						</Button>
					</div>
				</div>
			</div>
			<SavePlanDialog
				callbackUrl="/founder/results?save=1"
				onOpenChange={setSaveDialogOpen}
				open={saveDialogOpen}
			/>
			{saveError && (
				<p className="text-destructive text-sm" role="alert">
					{saveError}
				</p>
			)}
			{recommendations.length ? (
				<div className="grid gap-5 lg:grid-cols-3">
					{recommendations.map((recommendation) => (
						<ResourceCard
							key={recommendation.resource.id}
							reasons={recommendation.reasons}
							resource={recommendation.resource}
							score={recommendation.score}
						/>
					))}
				</div>
			) : (
				<EmptyState
					description="No published resources match this intake yet. Try broadening your goals or import resources from the admin panel."
					icon={Compass}
					title="No recommendations yet"
				/>
			)}
		</div>
	);
}
