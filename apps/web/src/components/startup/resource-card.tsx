"use client";

import {
	ArrowUpRight,
	Bookmark,
	CheckCircle2,
	Loader2,
	Mail,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { apiClient, compactDate, type Resource } from "~/lib/startup-api";
import { TagList } from "./tag-list";

export function ResourceCard({
	resource,
	reasons,
	score,
}: {
	resource: Resource;
	reasons?: string[];
	score?: number;
}) {
	const [isSaved, setIsSaved] = useState(Boolean(resource.isSaved));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const communities = taxonomyItems(resource.communities);
	const sectors = taxonomyItems(resource.sectors);
	const regions = taxonomyItems(resource.regions);
	const goals = taxonomyItems(resource.goals);
	const primaryTopic = goals[0] ?? resource.category;
	const updatedLabel = resource.updatedAt
		? compactDateOrFallback(resource.updatedAt)
		: "recently";

	async function toggleSaved() {
		setSaving(true);
		setError(null);
		try {
			if (isSaved) {
				await apiClient(`/api/v1/resources/unsave`, {
					method: "POST",
					body: JSON.stringify({ resourceId: resource.id }),
				});
				setIsSaved(false);
			} else {
				await apiClient("/api/v1/resources/save", {
					method: "POST",
					body: JSON.stringify({ resourceId: resource.id }),
				});
				setIsSaved(true);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Sign in to save resources.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<article className="flex h-full flex-col rounded-lg border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="flex flex-wrap items-center gap-2">
						{primaryTopic && (
							<Badge className="rounded-md">{primaryTopic}</Badge>
						)}
						{typeof score === "number" && (
							<Badge className="rounded-md bg-emerald-600 text-white">
								{score} match
							</Badge>
						)}
					</div>
					<Link href={`/resources/${resource.id}`}>
						<h3 className="mt-3 font-semibold text-xl leading-tight hover:text-emerald-700">
							{resource.name}
						</h3>
					</Link>
				</div>
				<Button
					aria-label={isSaved ? "Unsave resource" : "Save resource"}
					disabled={saving}
					onClick={toggleSaved}
					size="icon-sm"
					type="button"
					variant="ghost"
				>
					{saving ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Bookmark
							className={
								isSaved
									? "size-5 fill-amber-400 text-amber-500"
									: "size-5 text-muted-foreground"
							}
						/>
					)}
				</Button>
			</div>
			{error && <p className="mt-2 text-destructive text-sm">{error}</p>}
			<p className="mt-3 line-clamp-3 text-muted-foreground text-sm">
				{resource.shortDescription || resource.description}
			</p>
			{reasons?.length ? (
				<div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-emerald-950 text-sm">
					<div className="mb-1 flex items-center gap-2 font-medium">
						<CheckCircle2 className="size-4" />
						Why this matches you
					</div>
					<ul className="space-y-1">
						{reasons.slice(0, 3).map((reason) => (
							<li key={reason}>{reason}</li>
						))}
					</ul>
				</div>
			) : null}
			<div className="mt-4 space-y-3">
				<TaxonomyRow items={communities} label="Communities" />
				<TaxonomyRow items={sectors} label="Industries" />
				<TaxonomyRow items={regions} label="Locations" />
				<TaxonomyRow items={goals} label="Topics" />
			</div>
			{resource.contactEmail && (
				<p className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
					<Mail className="size-4" />
					{resource.contactEmail}
				</p>
			)}
			<div className="mt-auto flex items-center justify-between gap-3 pt-5">
				<span className="text-muted-foreground text-xs">
					Updated {updatedLabel}
				</span>
				{resource.websiteUrl ? (
					<Button asChild size="sm" variant="outline">
						<a href={resource.websiteUrl} rel="noreferrer" target="_blank">
							Open
							<ArrowUpRight className="size-4" />
						</a>
					</Button>
				) : (
					<Button asChild size="sm" variant="outline">
						<Link href={`/resources/${resource.id}`}>
							Open
							<ArrowUpRight className="size-4" />
						</Link>
					</Button>
				)}
			</div>
		</article>
	);
}

function taxonomyItems(items: unknown) {
	if (!Array.isArray(items)) return [];
	return items.flatMap((item) => {
		if (typeof item !== "string") return [];
		const trimmed = item.trim();
		return trimmed ? [trimmed] : [];
	});
}

function compactDateOrFallback(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "recently" : compactDate(value);
}

function TaxonomyRow({ label, items }: { label: string; items: string[] }) {
	if (!items.length) return null;
	return (
		<div className="space-y-1">
			<p className="font-medium text-muted-foreground text-xs">{label}</p>
			<TagList items={items} limit={3} />
		</div>
	);
}
