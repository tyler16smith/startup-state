import { PrismaClient } from "../generated/prisma";

const db = new PrismaClient();

async function main() {
	const demoUser = await db.user.upsert({
		where: { email: "demo@internal.system" },
		create: {
			email: "demo@internal.system",
			name: "Demo User",
			settings: {
				create: { hasCompletedInitialOnboarding: true },
			},
		},
		update: {
			name: "Demo User",
		},
		select: { id: true },
	});

	await db.userSettings.upsert({
		where: { userId: demoUser.id },
		create: {
			userId: demoUser.id,
			hasCompletedInitialOnboarding: true,
		},
		update: { hasCompletedInitialOnboarding: true },
	});

	await db.resource.upsert({
		where: { slug: "utah-small-business-development-center" },
		create: {
			name: "Utah Small Business Development Center",
			slug: "utah-small-business-development-center",
			description:
				"Statewide advising network for Utah founders working through launch, financing, market validation, and growth planning.",
			shortDescription:
				"Free statewide advising for Utah founders from idea to growth.",
			websiteUrl: "https://utahsbdc.org",
			category: "Mentorship",
			stages: ["IDEA", "PRE_REVENUE", "EARLY_REVENUE"],
			sectors: ["Software", "Consumer", "Advanced manufacturing"],
			goals: ["Mentorship", "Capital", "Education"],
			regions: ["Statewide", "Wasatch Front", "Southern Utah"],
			businessTypes: ["B2B", "B2C", "Main street"],
			eligibilityTags: ["Utah business", "Founder"],
		},
		update: {},
	});

	await db.resource.upsert({
		where: { slug: "goeo-startup-grants-navigation" },
		create: {
			name: "GOEO Startup Grants Navigation",
			slug: "goeo-startup-grants-navigation",
			description:
				"A curated path for identifying Utah grant, incentive, exporting, and rural growth programs that may fit a young company.",
			shortDescription:
				"Find Utah grant and incentive programs that fit your startup stage and region.",
			websiteUrl: "https://business.utah.gov",
			category: "Grants",
			stages: ["PRE_REVENUE", "EARLY_REVENUE", "GROWTH"],
			sectors: ["Aerospace", "Energy", "Advanced manufacturing", "Software"],
			goals: ["Grants", "Exporting", "Capital"],
			regions: ["Statewide", "Rural Utah"],
			businessTypes: ["B2B", "Deep tech"],
			eligibilityTags: ["Utah business", "Program fit varies"],
		},
		update: {},
	});

	await db.company.upsert({
		where: { slug: "peak-civic-labs" },
		create: {
			name: "Peak Civic Labs",
			slug: "peak-civic-labs",
			websiteUrl: "https://example.com/peak-civic-labs",
			description:
				"Salt Lake City software company building workflow tools for public-sector economic development teams.",
			sector: "Software",
			stage: "EARLY_REVENUE",
			employees: 18,
			employeeRange: "11-50",
			yearFounded: 2023,
			city: "Salt Lake City",
			county: "Salt Lake",
			latitude: 40.7608,
			longitude: -111.891,
			hiringStatus: "HIRING",
			status: "PUBLISHED",
		},
		update: {},
	});

	await db.company.upsert({
		where: { slug: "red-rock-robotics" },
		create: {
			name: "Red Rock Robotics",
			slug: "red-rock-robotics",
			websiteUrl: "https://example.com/red-rock-robotics",
			description:
				"Southern Utah hardware startup developing inspection robotics for energy and infrastructure operators.",
			sector: "Advanced manufacturing",
			stage: "GROWTH",
			employees: 42,
			employeeRange: "11-50",
			yearFounded: 2021,
			city: "St. George",
			county: "Washington",
			latitude: 37.0965,
			longitude: -113.5684,
			hiringStatus: "ACTIVELY_HIRING",
			status: "PUBLISHED",
		},
		update: {},
	});
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => db.$disconnect());
