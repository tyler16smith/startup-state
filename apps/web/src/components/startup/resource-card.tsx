"use client";

import { ArrowUpRight, Bookmark, CheckCircle2, Loader2 } from "lucide-react";
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
						{resource.category && (
							<Badge className="rounded-md">{resource.category}</Badge>
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
				<TagList
					items={[...resource.stages, ...resource.goals, ...resource.regions]}
				/>
			</div>
			<div className="mt-auto flex items-center justify-between gap-3 pt-5">
				<span className="text-muted-foreground text-xs">
					Updated {compactDate(resource.updatedAt)}
				</span>
				<Button asChild size="sm" variant="outline">
					<Link href={`/resources/${resource.id}`}>
						Open
						<ArrowUpRight className="size-4" />
					</Link>
				</Button>
			</div>
		</article>
	);
}
