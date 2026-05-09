import type { MessageReference } from "@app/mcp-contracts";
import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "~/components/ui/hover-card";
import { cn } from "~/lib/utils";

function isInternalHref(href: string) {
	return href.startsWith("/");
}

function referenceKindLabel(kind: MessageReference["kind"]) {
	switch (kind) {
		case "resource":
			return "Resource";
		case "company":
			return "Company";
		case "url":
			return "Source";
	}
}

function ReferenceLink({ href }: { href: string }) {
	const className =
		"mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 font-medium text-xs transition-colors hover:bg-muted";
	if (isInternalHref(href)) {
		return (
			<Link className={className} href={href + "?agent=open"}>
				Open
				<ArrowRight className="size-3" />
			</Link>
		);
	}

	return (
		<a className={className} href={href} rel="noreferrer" target="_blank">
			Open
			<ExternalLink className="size-3" />
		</a>
	);
}

function ReferenceCard({ reference }: { reference: MessageReference }) {
	return (
		<div className="min-w-0">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="font-semibold text-sm leading-5">{reference.title}</p>
					{reference.subtitle ? (
						<p className="mt-0.5 text-muted-foreground text-xs leading-5">
							{reference.subtitle}
						</p>
					) : null}
				</div>
				<span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-normal">
					{referenceKindLabel(reference.kind)}
				</span>
			</div>
			{reference.excerpt ? (
				<p className="mt-2 text-muted-foreground text-xs leading-5">
					{reference.excerpt}
				</p>
			) : null}
			{reference.reasons?.length ? (
				<ul className="mt-2 grid gap-1 text-emerald-700 text-xs leading-5">
					{reference.reasons.slice(0, 3).map((reason) => (
						<li key={reason}>{reason}</li>
					))}
				</ul>
			) : null}
			{reference.href ? <ReferenceLink href={reference.href} /> : null}
		</div>
	);
}

export function InlineReferenceBadge({
	index,
	reference,
}: {
	index: number;
	reference?: MessageReference;
}) {
	if (!reference) {
		return (
			<span className="mx-0.5 inline-flex h-5 min-w-5 translate-y-[-1px] items-center justify-center rounded-full border bg-muted px-1.5 align-baseline font-semibold text-[10px] text-muted-foreground opacity-70">
				?
			</span>
		);
	}

	return (
		<HoverCard closeDelay={120} openDelay={120}>
			<HoverCardTrigger asChild>
				<button
					aria-label={`Reference ${index}: ${reference.title}`}
					className="mx-0.5 inline-flex h-5 min-w-5 translate-y-[-1px] items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 align-baseline font-semibold text-[10px] text-emerald-800 transition-colors hover:bg-emerald-100"
					type="button"
				>
					{index}
				</button>
			</HoverCardTrigger>
			<HoverCardContent
				align="start"
				className="w-80 max-w-[calc(100vw-2rem)] p-3"
			>
				<ReferenceCard reference={reference} />
			</HoverCardContent>
		</HoverCard>
	);
}

export function GroupedMessageReferences({
	className,
	references,
}: {
	className?: string;
	references: MessageReference[];
}) {
	if (references.length === 0) return null;

	return (
		<HoverCard closeDelay={120} openDelay={120}>
			<HoverCardTrigger asChild>
				<button
					className={cn(
						"inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground",
						className,
					)}
					type="button"
				>
					Sources
					<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
						{references.length}
					</span>
				</button>
			</HoverCardTrigger>
			<HoverCardContent
				align="start"
				className="w-96 max-w-[calc(100vw-2rem)] p-0"
			>
				<div className="max-h-96 overflow-auto p-3">
					<div className="grid gap-3">
						{references.map((reference) => (
							<div className="rounded-md border p-3" key={reference.id}>
								<ReferenceCard reference={reference} />
							</div>
						))}
					</div>
				</div>
			</HoverCardContent>
		</HoverCard>
	);
}
