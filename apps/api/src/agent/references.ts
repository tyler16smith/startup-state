import type { AgentReference } from "@app/mcp-contracts";

type ReferenceBaseInput = {
	id: string;
	title: string;
	subtitle?: string | null;
	excerpt?: string | null;
	href: string;
	section?: string;
	sourceId?: string;
	sourceSlug?: string;
	sourceTable?: string;
	sourceField?: string;
	toolName?: string;
	score?: number;
	reasons?: string[];
};

function trimText(value: string | null | undefined, limit: number) {
	const trimmed = value?.replace(/\s+/g, " ").trim();
	if (!trimmed) return undefined;
	return trimmed.length > limit ? `${trimmed.slice(0, limit - 3)}...` : trimmed;
}

function buildReference(
	kind: AgentReference["kind"],
	input: ReferenceBaseInput,
): AgentReference {
	return {
		id: input.id,
		kind,
		sourceId: input.sourceId,
		sourceSlug: input.sourceSlug,
		title: input.title,
		subtitle: trimText(input.subtitle, 240),
		excerpt: trimText(input.excerpt, 600),
		href: input.href,
		section: input.section,
		sourceTable: input.sourceTable,
		sourceField: input.sourceField,
		toolName: input.toolName,
		score: input.score,
		reasons: input.reasons?.slice(0, 6),
	};
}

export function createResourceReference(input: {
	resource: {
		id: string;
		slug: string;
		name: string;
		shortDescription?: string | null;
		description?: string | null;
		category?: string | null;
	};
	toolName: string;
	section?: string;
	score?: number;
	reasons?: string[];
}): AgentReference {
	return buildReference("resource", {
		id: `resource:${input.resource.id}${input.section ? `:${input.section}` : ""}`,
		sourceId: input.resource.id,
		sourceSlug: input.resource.slug,
		title: input.resource.name,
		subtitle: input.resource.category,
		excerpt: input.resource.shortDescription ?? input.resource.description,
		href: `/resources/${input.resource.id}${input.section ? `#${input.section}` : ""}`,
		section: input.section,
		sourceTable: "Resource",
		sourceField: input.section ?? "overview",
		toolName: input.toolName,
		score: input.score,
		reasons: input.reasons,
	});
}

export function createCompanyReference(input: {
	company: {
		id: string;
		slug: string;
		name: string;
		description?: string | null;
		sector?: string | null;
		stage?: string | null;
		city?: string | null;
		county?: string | null;
	};
	toolName: string;
	section?: string;
}): AgentReference {
	const location = [input.company.city, input.company.county]
		.filter(Boolean)
		.join(", ");
	return buildReference("company", {
		id: `company:${input.company.id}${input.section ? `:${input.section}` : ""}`,
		sourceId: input.company.id,
		sourceSlug: input.company.slug,
		title: input.company.name,
		subtitle: [input.company.sector, input.company.stage, location]
			.filter(Boolean)
			.join(" - "),
		excerpt: input.company.description,
		href: `/companies/${input.company.id}${input.section ? `#${input.section}` : ""}`,
		section: input.section,
		sourceTable: "Company",
		sourceField: input.section ?? "overview",
		toolName: input.toolName,
	});
}

export function createResourceSearchReference(input: {
	title: string;
	params: Record<string, string | number | undefined>;
	toolName: string;
}): AgentReference {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(input.params)) {
		if (value !== undefined && value !== "") search.set(key, String(value));
	}
	return buildReference("resource_search", {
		id: `resource-search:${search.toString() || "all"}`,
		title: input.title,
		excerpt: "Open this filtered resource search.",
		href: `/resources${search.toString() ? `?${search.toString()}` : ""}`,
		toolName: input.toolName,
	});
}

export function createMapSearchReference(input: {
	title: string;
	params: Record<string, string | number | undefined>;
	toolName: string;
}): AgentReference {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(input.params)) {
		if (value !== undefined && value !== "") search.set(key, String(value));
	}
	return buildReference("map_search", {
		id: `map-search:${search.toString() || "all"}`,
		title: input.title,
		excerpt: "Open this company view on the ecosystem map.",
		href: `/map${search.toString() ? `?${search.toString()}` : ""}`,
		toolName: input.toolName,
	});
}

export function createFounderIntakeReference(toolName: string): AgentReference {
	return buildReference("founder_intake", {
		id: "founder-intake",
		title: "Founder intake",
		excerpt: "Answer a short intake to get more targeted resource matches.",
		href: "/founder",
		toolName,
	});
}
