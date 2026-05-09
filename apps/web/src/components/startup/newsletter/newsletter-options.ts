import {
	BadgeDollarSign,
	BellRing,
	BriefcaseBusiness,
	CalendarDays,
	ChartNoAxesCombined,
	Flag,
	Handshake,
	Megaphone,
	Rocket,
	Sparkles,
	Telescope,
	Users,
} from "lucide-react";
import type { NewsletterAudience } from "~/lib/startup-api";

export type NewsletterAudienceOption = {
	id: "founder" | "investor" | "both";
	label: string;
	audiences: NewsletterAudience[];
	shortLabel: string;
	description: string;
	body: string;
	cta: string;
	includes: string[];
	accent: string;
};

export type NewsletterInterestOption = {
	id: string;
	label: string;
	audiences: NewsletterAudience[];
	icon: typeof Sparkles;
};

export const audienceOptions: NewsletterAudienceOption[] = [
	{
		id: "founder",
		label: "Founder Newsletter",
		audiences: ["FOUNDER"],
		shortLabel: "Founder",
		description: "For founders, operators, and builders.",
		body: "Stay up to date on what is happening across the startup community, including events, funding opportunities, founder resources, featured companies, and tactical updates to help you build momentum.",
		cta: "Subscribe as a Founder",
		includes: [
			"Upcoming startup events",
			"Funding opportunities and grants",
			"Founder resources and tools",
			"Community highlights",
			"Startup State updates",
		],
		accent: "border-emerald-700 bg-emerald-50",
	},
	{
		id: "investor",
		label: "Investor Newsletter",
		audiences: ["INVESTOR"],
		shortLabel: "Investor",
		description: "For angels, funds, scouts, and ecosystem investors.",
		body: "Get relevant updates on startups in the ecosystem, including companies preparing for a new round, major traction milestones, standout startup highlights, and curated opportunities worth watching.",
		cta: "Subscribe as an Investor",
		includes: [
			"Companies preparing to raise",
			"Revenue and growth milestones",
			"Startup highlights",
			"Major company updates",
			"Ecosystem investment signals",
		],
		accent: "border-sky-700 bg-sky-50",
	},
	{
		id: "both",
		label: "Founder and Investor Signals",
		audiences: ["FOUNDER", "INVESTOR"],
		shortLabel: "Both",
		description: "For people building and backing the ecosystem.",
		body: "Follow the full Startup State signal feed across founder resources, company momentum, capital activity, events, and ecosystem updates.",
		cta: "Subscribe to Both",
		includes: [
			"Founder and investor updates",
			"Fundraising signals",
			"Demo days and events",
			"Resource highlights",
			"Company announcements",
		],
		accent: "border-amber-700 bg-amber-50",
	},
];

export const interestOptions: NewsletterInterestOption[] = [
	{
		id: "fundraising_opportunities",
		label: "Fundraising opportunities",
		audiences: ["FOUNDER"],
		icon: BadgeDollarSign,
	},
	{
		id: "events_and_meetups",
		label: "Events and meetups",
		audiences: ["FOUNDER"],
		icon: CalendarDays,
	},
	{
		id: "founder_resources",
		label: "Founder resources",
		audiences: ["FOUNDER"],
		icon: Rocket,
	},
	{
		id: "hiring_and_talent",
		label: "Hiring and talent",
		audiences: ["FOUNDER"],
		icon: Users,
	},
	{
		id: "grants_and_incentives",
		label: "Grants and incentives",
		audiences: ["FOUNDER"],
		icon: Handshake,
	},
	{
		id: "platform_updates",
		label: "Startup State platform updates",
		audiences: ["FOUNDER"],
		icon: BellRing,
	},
	{
		id: "community_highlights",
		label: "Community highlights",
		audiences: ["FOUNDER"],
		icon: Sparkles,
	},
	{
		id: "companies_preparing_to_raise",
		label: "Companies preparing to raise",
		audiences: ["INVESTOR"],
		icon: Flag,
	},
	{
		id: "early_stage_startups",
		label: "Early-stage startups",
		audiences: ["INVESTOR"],
		icon: Telescope,
	},
	{
		id: "growth_stage_startups",
		label: "Growth-stage startups",
		audiences: ["INVESTOR"],
		icon: ChartNoAxesCombined,
	},
	{
		id: "revenue_milestones",
		label: "Revenue milestones",
		audiences: ["INVESTOR"],
		icon: BadgeDollarSign,
	},
	{
		id: "sector_specific_updates",
		label: "Sector-specific updates",
		audiences: ["INVESTOR"],
		icon: BriefcaseBusiness,
	},
	{
		id: "demo_days_and_pitch_events",
		label: "Demo days and pitch events",
		audiences: ["INVESTOR"],
		icon: CalendarDays,
	},
	{
		id: "major_company_announcements",
		label: "Major company announcements",
		audiences: ["INVESTOR"],
		icon: Megaphone,
	},
];

export const intentOptions = [
	"Building",
	"Investing",
	"Hiring",
	"Fundraising",
	"Exploring the ecosystem",
];

export const stageOptions = [
	"Idea",
	"Pre-revenue",
	"Early revenue",
	"Growth",
	"Scaling",
	"Pre-seed",
	"Seed",
	"Series A",
	"Later stage",
	"Any stage",
];
