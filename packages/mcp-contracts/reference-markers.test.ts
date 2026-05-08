import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createMessageReferenceLookup,
	getReferenceKey,
	normalizeMessageReferences,
	parseMessageContentReferences,
} from "./src/references";

const exampleReferencesDone = {
	type: "references_done",
	referenceBlockId: "references-run-tool",
	toolCallId: "tool-call-1",
	toolName: "recommend_founder_resources",
	references: [
		{
			id: "resource:cmow486870005svnwfittgbsm",
			kind: "resource",
			sourceId: "cmow486870005svnwfittgbsm",
			sourceSlug: "goeo-startup-grants-navigation",
			title: "GOEO Startup Grants Navigation",
			subtitle: "Grants",
			excerpt:
				"Find Utah grant and incentive programs that fit your startup stage and region.",
			href: "/resources/cmow486870005svnwfittgbsm",
		},
		{
			id: "resource:cmow486280004svnw3ee54gj0",
			kind: "resource",
			sourceId: "cmow486280004svnw3ee54gj0",
			sourceSlug: "utah-small-business-development-center",
			title: "Utah Small Business Development Center",
			subtitle: "Mentorship",
			excerpt: "Free statewide advising for Utah founders from idea to growth.",
			href: "/resources/cmow486280004svnw3ee54gj0",
		},
	],
};

const exampleAssistantContent = `Start with GOEO Startup Grants Navigation because it can help you find Utah grant and incentive programs that match your startup stage and region. [ref:resource:cmow486870005svnwfittgbsm]

Use the Utah Small Business Development Center for free statewide advising and capital guidance. [ref:resource:cmow486280004svnw3ee54gj0]`;

describe("inline reference markers", () => {
	it("normalizes references and resolves example markers", () => {
		const references = normalizeMessageReferences(
			exampleReferencesDone.references,
			{ toolName: exampleReferencesDone.toolName },
		);
		const lookup = createMessageReferenceLookup(references);
		const segments = parseMessageContentReferences(exampleAssistantContent);
		const referenceSegments = segments.filter(
			(segment) => segment.type === "reference",
		);

		assert.equal(references.length, 2);
		assert.equal(referenceSegments.length, 2);
		assert.equal(
			lookup.get(referenceSegments[0]?.key ?? "")?.title,
			"GOEO Startup Grants Navigation",
		);
		assert.equal(
			lookup.get(referenceSegments[1]?.key ?? "")?.title,
			"Utah Small Business Development Center",
		);
	});

	it("namespaces raw IDs and preserves namespaced IDs", () => {
		assert.equal(
			getReferenceKey("resource", "cmow486870005svnwfittgbsm"),
			"resource:cmow486870005svnwfittgbsm",
		);
		assert.equal(
			getReferenceKey("resource", "resource:cmow486870005svnwfittgbsm"),
			"resource:cmow486870005svnwfittgbsm",
		);
	});

	it("maps legacy resource-search markers to url references", () => {
		const references = normalizeMessageReferences([
			{
				id: "resource-search:q=fintech+funding&sector=Fintech&limit=5",
				kind: "resource_search",
				title: "Fintech funding resources",
				excerpt: "Open this filtered resource search.",
				href: "/resources?q=fintech+funding&sector=Fintech&limit=5",
			},
		]);
		const lookup = createMessageReferenceLookup(references);
		const segments = parseMessageContentReferences(
			"Should I widen the search? [ref:resource-search:q=fintech+funding&sector=Fintech&limit=5]",
		);
		const referenceSegment = segments.find(
			(segment) => segment.type === "reference",
		);

		assert.equal(references[0]?.kind, "url");
		assert.equal(
			references[0]?.id,
			"url:resource-search:q=fintech+funding&sector=Fintech&limit=5",
		);
		assert.equal(
			referenceSegment?.type === "reference"
				? lookup.get(referenceSegment.key)?.title
				: undefined,
			"Fintech funding resources",
		);
	});
});
