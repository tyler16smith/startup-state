"use client";

import { ArrowRight, Compass, Loader2, Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "~/components/startup/empty-state";
import { ResourceCard } from "~/components/startup/resource-card";
import { Button } from "~/components/ui/button";
import {
	apiClient,
	type FounderProfileInput,
	type ResourceRecommendation,
} from "~/lib/startup-api";

export function FounderResults() {
	const [recommendations, setRecommendations] = useState<
		ResourceRecommendation[]
	>([]);
	const [profile, setProfile] = useState<FounderProfileInput | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const raw = sessionStorage.getItem("startup-founder-intake");
		if (!raw) {
			setLoading(false);
			return;
		}
		const input = JSON.parse(raw) as FounderProfileInput;
		setProfile(input);
		apiClient<{ recommendations: ResourceRecommendation[] }>(
			"/api/v1/resources/recommend",
			{
				method: "POST",
				body: JSON.stringify(input),
			},
		)
			.then((data) => setRecommendations(data.recommendations))
			.catch((err: unknown) =>
				setError(
					err instanceof Error ? err.message : "Could not load recommendations",
				),
			)
			.finally(() => setLoading(false));
	}, []);

	if (loading) {
		return (
			<div className="flex min-h-80 items-center justify-center rounded-lg border bg-white">
				<div className="flex items-center gap-3 text-muted-foreground">
					<Loader2 className="size-5 animate-spin" /> Building your Utah startup
					action plan
				</div>
			</div>
		);
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
							Personalized action plan
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
					<div className="flex gap-2">
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
