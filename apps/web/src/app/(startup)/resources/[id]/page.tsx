import { ArrowUpRight, Mail, Phone, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceCard } from "~/components/startup/resource-card";
import { TagList } from "~/components/startup/tag-list";
import { Button } from "~/components/ui/button";
import type { Resource } from "~/lib/startup-api";
import { getResource } from "~/lib/startup-server-api";

export default async function ResourceDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	let resource: Resource;
	try {
		resource = await getResource(id);
	} catch {
		notFound();
	}

	return (
		<main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
			<div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
				<section
					className="rounded-lg border bg-white p-6 shadow-sm sm:p-8"
					id="resource-overview"
				>
					<div className="flex flex-wrap gap-2">
						<TagList
							items={[resource.category ?? "Resource", ...resource.goals]}
						/>
					</div>
					<h1 className="mt-4 font-semibold text-4xl tracking-normal">
						{resource.name}
					</h1>
					<p className="mt-4 whitespace-pre-wrap text-muted-foreground leading-7">
						{resource.description}
					</p>
					<div className="mt-8 grid gap-6 md:grid-cols-2" id="resource-fit">
						<Info title="Stage fit" values={resource.stages} />
						<Info title="Sector fit" values={resource.sectors} />
						<Info title="Region fit" values={resource.regions} />
						<Info title="Eligibility" values={resource.eligibilityTags} />
					</div>
				</section>
				<aside className="space-y-4">
					<div
						className="rounded-lg border bg-white p-5 shadow-sm"
						id="resource-contact"
					>
						<h2 className="font-semibold">Contact</h2>
						<div className="mt-4 space-y-3 text-sm">
							{resource.websiteUrl && (
								<Button asChild className="w-full justify-between">
									<a
										href={resource.websiteUrl}
										rel="noreferrer"
										target="_blank"
									>
										Visit website <ArrowUpRight className="size-4" />
									</a>
								</Button>
							)}
							{resource.contactEmail && (
								<p className="flex items-center gap-2">
									<Mail className="size-4" />
									{resource.contactEmail}
								</p>
							)}
							{resource.contactPhone && (
								<p className="flex items-center gap-2">
									<Phone className="size-4" />
									{resource.contactPhone}
								</p>
							)}
							{(resource.city || resource.county) && (
								<p>
									{[resource.city, resource.county, resource.state]
										.filter(Boolean)
										.join(", ")}
								</p>
							)}
						</div>
					</div>
					<Button asChild className="w-full" variant="outline">
						<Link href="/founder">Run founder intake</Link>
					</Button>
				</aside>
			</div>
			{resource.related?.length ? (
				<section className="mt-10" id="resource-related">
					<h2 className="mb-4 font-semibold text-2xl">Related resources</h2>
					<div className="grid gap-5 md:grid-cols-3">
						{resource.related.map((item) => (
							<ResourceCard key={item.id} resource={item} />
						))}
					</div>
				</section>
			) : null}
		</main>
	);
}

function Info({ title, values }: { title: string; values: string[] }) {
	return (
		<div className="rounded-lg border bg-slate-50 p-4">
			<h2 className="mb-3 flex items-center gap-2 font-medium">
				<Sparkles className="size-4 text-emerald-700" />
				{title}
			</h2>
			<TagList items={values} limit={10} />
		</div>
	);
}
