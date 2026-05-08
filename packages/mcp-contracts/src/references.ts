import type { AgentReference } from "./schemas";

export const referenceKinds = ["resource", "company", "url"] as const;

export type ReferenceKind = (typeof referenceKinds)[number];

export type MessageReference = {
	id: string;
	kind: ReferenceKind;
	title: string;
	subtitle?: string | null;
	excerpt?: string | null;
	href?: string | null;
	sourceId?: string | null;
	sourceSlug?: string | null;
	sourceTable?: string | null;
	sourceField?: string | null;
	toolName?: string | null;
	score?: number | null;
	reasons?: string[];
};

export type MessageSegment =
	| { type: "text"; text: string }
	| { type: "reference"; key: string; kind: ReferenceKind; rawId: string };

export const REF_MARKER_REGEX = /\[ref:(resource|company|url):([^\]]+)\]/g;

const ANY_REF_MARKER_REGEX = /\[ref:([a-z_-]+):([^\]]+)\]/g;

const TRAILING_REF_MARKER_REGEX = /\[ref:[a-z_-]+:[^\]]*$/;

type ReferenceLike = Partial<AgentReference> & {
	id?: unknown;
	kind?: unknown;
	title?: unknown;
	subtitle?: unknown;
	excerpt?: unknown;
	href?: unknown;
	sourceId?: unknown;
	sourceSlug?: unknown;
	sourceTable?: unknown;
	sourceField?: unknown;
	toolName?: unknown;
	score?: unknown;
	reasons?: unknown;
};

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
	return typeof value === "number" ? value : null;
}

function normalizeReferenceKind(value: unknown): ReferenceKind | null {
	if (isReferenceKind(value)) return value;
	if (
		value === "resource_search" ||
		value === "resource-search" ||
		value === "map_search" ||
		value === "map-search"
	) {
		return "url";
	}
	return null;
}

function getMarkerReferenceKey(kind: string, rawId: string): string | null {
	if (isReferenceKind(kind)) return getReferenceKey(kind, rawId);
	if (kind === "resource-search" || kind === "resource_search") {
		return getReferenceKey("url", `resource-search:${rawId}`);
	}
	if (kind === "map-search" || kind === "map_search") {
		return getReferenceKey("url", `map-search:${rawId}`);
	}
	return null;
}

export function isReferenceKind(value: unknown): value is ReferenceKind {
	return value === "resource" || value === "company" || value === "url";
}

export function getReferenceKey(kind: ReferenceKind, id: string): string {
	const trimmedId = id.trim();
	return trimmedId.startsWith(`${kind}:`) ? trimmedId : `${kind}:${trimmedId}`;
}

export function normalizeMessageReference(
	reference: ReferenceLike,
	options: { toolName?: string | null } = {},
): MessageReference | null {
	const kind = normalizeReferenceKind(reference.kind);
	if (!kind) return null;
	const rawId = stringOrNull(reference.id);
	const title = stringOrNull(reference.title);
	if (!rawId || !title) return null;

	return {
		id: getReferenceKey(kind, rawId),
		kind,
		title,
		subtitle: stringOrNull(reference.subtitle),
		excerpt: stringOrNull(reference.excerpt),
		href: stringOrNull(reference.href),
		sourceId: stringOrNull(reference.sourceId),
		sourceSlug: stringOrNull(reference.sourceSlug),
		sourceTable: stringOrNull(reference.sourceTable),
		sourceField: stringOrNull(reference.sourceField),
		toolName: stringOrNull(reference.toolName) ?? options.toolName ?? null,
		score: numberOrNull(reference.score),
		reasons: Array.isArray(reference.reasons)
			? reference.reasons.filter(
					(reason): reason is string =>
						typeof reason === "string" && reason.length > 0,
				)
			: undefined,
	};
}

export function normalizeMessageReferences(
	references: unknown,
	options: { toolName?: string | null } = {},
): MessageReference[] {
	if (!Array.isArray(references)) return [];
	return references.flatMap((reference) => {
		const normalized = normalizeMessageReference(
			reference as ReferenceLike,
			options,
		);
		return normalized ? [normalized] : [];
	});
}

export function mergeMessageReferences(
	existing: MessageReference[] | undefined,
	incoming: MessageReference[],
): MessageReference[] {
	const referencesById = new Map<string, MessageReference>();
	for (const reference of existing ?? []) {
		referencesById.set(reference.id, reference);
	}
	for (const reference of incoming) {
		referencesById.set(reference.id, reference);
	}
	return Array.from(referencesById.values());
}

export function createMessageReferenceLookup(
	references: MessageReference[] | undefined,
): Map<string, MessageReference> {
	const lookup = new Map<string, MessageReference>();
	for (const reference of references ?? []) {
		lookup.set(reference.id, reference);
		lookup.set(getReferenceKey(reference.kind, reference.id), reference);
		if (reference.sourceId) {
			lookup.set(
				getReferenceKey(reference.kind, reference.sourceId),
				reference,
			);
		}
		if (reference.sourceSlug) {
			lookup.set(
				getReferenceKey(reference.kind, reference.sourceSlug),
				reference,
			);
		}
		if (reference.kind !== "url") {
			const [_kind, baseId] = reference.id.split(":");
			if (baseId)
				lookup.set(getReferenceKey(reference.kind, baseId), reference);
		}
	}
	return lookup;
}

export function parseMessageContentReferences(
	content: string,
): MessageSegment[] {
	const segments: MessageSegment[] = [];
	const regex = new RegExp(ANY_REF_MARKER_REGEX);
	let previousIndex = 0;
	let match = regex.exec(content);

	while (match) {
		const [marker, kind, rawId] = match;
		const markerIndex = match.index;
		if (markerIndex > previousIndex) {
			segments.push({
				type: "text",
				text: content.slice(previousIndex, markerIndex),
			});
		}
		const key = kind && rawId ? getMarkerReferenceKey(kind, rawId) : null;
		const normalizedKind = normalizeReferenceKind(kind);
		if (key && normalizedKind && rawId) {
			segments.push({
				type: "reference",
				key,
				kind: normalizedKind,
				rawId,
			});
		}
		previousIndex = markerIndex + marker.length;
		match = regex.exec(content);
	}

	const remainingText = content
		.slice(previousIndex)
		.replace(TRAILING_REF_MARKER_REGEX, "");
	if (remainingText) segments.push({ type: "text", text: remainingText });

	return segments;
}
