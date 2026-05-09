import {
	mcpToolContracts,
	type SupportDocumentationInput,
	type SupportDocumentationTopic,
} from "@app/mcp-contracts";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

type SupportSection = {
	topic: SupportDocumentationTopic;
	title: string;
	summary: string;
	whereToGo: string[];
	commonQuestions: string[];
	nextSteps: string[];
};

const supportSections: SupportSection[] = [
	{
		topic: "getting_started",
		title: "Getting started",
		summary:
			"Startup State Navigator helps founders find Utah startup resources and helps investors explore Utah companies.",
		whereToGo: [
			"Open Navigator from the sidebar or home page to choose a founder or investor path.",
			"Use Resources to browse grants, capital, mentorship, education, and support programs.",
			"Use Map to explore Utah companies by geography and ecosystem signals.",
		],
		commonQuestions: [
			"Do I need an account? You can browse public content, but saving plans and managing account settings requires signing in.",
			"Where is my homepage? Signed-in users with a saved navigator result are redirected to their latest saved plan.",
		],
		nextSteps: [
			"Founders should start with the founder flow if they want tailored resource recommendations.",
			"Investors should start with the investor flow or Map if they want company discovery.",
		],
	},
	{
		topic: "founder_navigator",
		title: "Founder Navigator",
		summary:
			"The founder flow collects a short intake and returns ranked Utah resources with reasons they may fit the company.",
		whereToGo: [
			"Open /founder or choose the founder path from Navigator.",
			"After results are generated, save the plan to make it available from /plan.",
		],
		commonQuestions: [
			"What inputs matter? Stage, location, industry, goals, business type, hiring status, and funding needs improve recommendations.",
			"Can I run it again? Yes. Re-run the founder flow when the company stage or goals change.",
		],
		nextSteps: [
			"Review the highest-scoring resources first.",
			"Open each resource profile to verify eligibility and contact details before applying.",
		],
	},
	{
		topic: "investor_explorer",
		title: "Investor explorer",
		summary:
			"The investor flow creates a company shortlist for users exploring Utah startups by sector, stage, location, size, and hiring signals.",
		whereToGo: [
			"Open /investor or choose the investor path from Navigator.",
			"Use /plan to revisit the latest saved investor shortlist.",
		],
		commonQuestions: [
			"What can I filter by? Sector, company stage, hiring status, geography, and company size are central signals.",
			"Are recommendations final diligence? No. Treat them as discovery leads and verify company details directly.",
		],
		nextSteps: [
			"Open company profiles from the shortlist.",
			"Use the Map for nearby companies and broader ecosystem context.",
		],
	},
	{
		topic: "resources",
		title: "Resource directory",
		summary:
			"The Resources page is a searchable directory of Utah startup programs, including state, regional, capital, mentorship, education, and support resources.",
		whereToGo: [
			"Open /resources from the sidebar.",
			"Search by keyword or filter by community, industry, location, topic, business type, and sort order.",
		],
		commonQuestions: [
			"Why did a resource appear? Matching is driven by structured metadata and, in navigator flows, recommendation reasons.",
			"Can users save resources? Signed-in users can save resources where the resource UI exposes that action.",
		],
		nextSteps: [
			"Use broad filters first, then narrow by topic or location.",
			"Open the resource detail page to inspect eligibility, contact information, and links.",
		],
	},
	{
		topic: "map_and_companies",
		title: "Map and companies",
		summary:
			"The Map shows Utah companies geographically, while company profiles provide details such as sector, stage, hiring status, job links, location, photos, and claims.",
		whereToGo: [
			"Open /map from the sidebar for geographic exploration.",
			"Open /companies/new to submit a Utah company listing for review.",
			"Open a company profile to view details or start a claim flow when available.",
		],
		commonQuestions: [
			"Why is a submitted company not public yet? New submissions require review before publishing.",
			"What if the map cannot load? The app includes company list-style fallbacks around map-driven exploration.",
		],
		nextSteps: [
			"Use filters to focus by sector, hiring signal, size, or geography.",
			"Submit missing companies with complete and verifiable details.",
		],
	},
	{
		topic: "ai_assistant",
		title: "AI assistant",
		summary:
			"The in-app assistant helps founders find resources and helps investors discover companies using customer-visible resource and company information.",
		whereToGo: [
			"The assistant workspace is available on core customer routes such as Resources, Map, Companies, and Explore.",
			"Ask focused questions about resources, eligibility, companies, locations, sectors, or next steps.",
		],
		commonQuestions: [
			"Can the assistant access private admin data? No. It is designed around customer-visible information.",
			"How should answers cite sources? Specific resources, companies, and URLs should be grounded with inline reference markers.",
		],
		nextSteps: [
			"Ask one clear question at a time when searching for recommendations.",
			"Use returned references to open the relevant resource or company page.",
		],
	},
	{
		topic: "account_settings",
		title: "Account settings",
		summary:
			"Account settings include profile management, household or team management, security controls, MCP access, and account deletion.",
		whereToGo: [
			"Open Account settings from the user menu in the sidebar.",
			"Use security settings for authentication controls and MCP access for external agent connections.",
		],
		commonQuestions: [
			"Why am I redirected to sign in? Settings, saved plans, and token management require an authenticated session.",
			"What are households? Household settings support shared account or team-style membership management.",
		],
		nextSteps: [
			"Keep profile and security settings current.",
			"Revoke old MCP tokens or OAuth connections that are no longer used.",
		],
	},
	{
		topic: "mcp_access",
		title: "MCP access",
		summary:
			"MCP access lets external agents connect to Startup State Navigator through scoped personal access tokens or OAuth connections.",
		whereToGo: [
			"Open Account settings, then MCP access.",
			"Create a personal access token for local stdio clients.",
			"Use a remote mcp-remote config for hosted MCP once the MCP app is deployed.",
		],
		commonQuestions: [
			"Which scope exists now? The current first-pass scope is mcp:read.",
			"Which clients are expected? The server has profiles for ChatGPT, Claude, Claude Desktop, Cursor, Codex, Gemini, OpenAI API, and local development.",
		],
		nextSteps: [
			"For local stdio, provide STARTUP_STATE_MCP_TOKEN and DATABASE_URL. MCP_TOKEN_PEPPER is optional for local dev when DATABASE_URL was used as the token hash pepper.",
			"For remote clients, connect through mcp-remote using the deployed /mcp URL.",
		],
	},
	{
		topic: "troubleshooting",
		title: "Troubleshooting",
		summary:
			"Most issues come from authentication state, missing environment variables, unpublished content, or a client using the wrong MCP transport URL.",
		whereToGo: [
			"Check Account settings for active MCP tokens and OAuth connections.",
			"Check /health on the MCP app for remote server availability.",
			"Check the API and web app env values when browser actions fail.",
		],
		commonQuestions: [
			"Why does an MCP request return unauthorized? The bearer token may be missing, revoked, expired, or hashed with a different token pepper.",
			"Why do OAuth redirects fail? Hosted clients must match trusted redirect host policy, and loopback clients must use http://localhost:<port>/oauth/callback.",
		],
		nextSteps: [
			"Regenerate the MCP token if it was copied incorrectly or expired.",
			"Confirm the MCP_BASE_URL and WEB_APP_URL values match the deployed environments.",
		],
	},
];

function matchesQuery(section: SupportSection, query: string): boolean {
	const normalizedQuery = query.toLowerCase();
	const searchableText = [
		section.title,
		section.summary,
		...section.whereToGo,
		...section.commonQuestions,
		...section.nextSteps,
	]
		.join(" ")
		.toLowerCase();
	return searchableText.includes(normalizedQuery);
}

function selectSections(input: SupportDocumentationInput): SupportSection[] {
	let selectedSections = supportSections;
	if (input.topic) {
		selectedSections = selectedSections.filter(
			(section) => section.topic === input.topic,
		);
	}
	if (input.query) {
		selectedSections = selectedSections.filter((section) =>
			matchesQuery(section, input.query ?? ""),
		);
	}
	return selectedSections.length > 0 ? selectedSections : supportSections;
}

export const getSupportDocumentationTool: McpToolImplementation<SupportDocumentationInput> =
	{
		contract: mcpToolContracts["mcp.get_support_documentation"],
		async execute(input) {
			const sections = selectSections(input);
			return schemaEnvelope("support.documentation.get", {
				requestedTopic: input.topic ?? null,
				query: input.query ?? null,
				sections,
				availableTopics: supportSections.map((section) => section.topic),
			});
		},
	};
