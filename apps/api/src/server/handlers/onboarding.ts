import { z } from "zod";
import { logger } from "~/lib/logger";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";

const completeInitialOnboardingSchema = z.object({
	acknowledged: z.boolean().default(true),
});

export const onboarding = {
	getOnboardingData: withAuth(async (ctx: AuthenticatedContext) => {
		const { userId } = ctx;

		const settings = await ctx.db.userSettings.findUnique({
			where: { userId },
			select: {
				hasCompletedInitialOnboarding: true,
			},
		});

		return {
			hasCompletedInitialOnboarding:
				settings?.hasCompletedInitialOnboarding ?? false,
		};
	}),

	completeInitialOnboarding: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			completeInitialOnboardingSchema.parse(body ?? {});
			const { userId } = ctx;

			await ctx.db.userSettings.upsert({
				where: { userId },
				create: {
					userId,
					hasCompletedInitialOnboarding: true,
				},
				update: {
					hasCompletedInitialOnboarding: true,
				},
			});

			logger.info("User completed initial onboarding", {
				userId,
				feature: "onboarding",
			});

			return { success: true };
		},
	),
};
