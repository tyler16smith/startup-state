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
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => db.$disconnect());
