import { z } from "zod";

export const emptyInputSchema = z.object({}).strict();

export const profileInfoSchema = z
	.object({
		id: z.string(),
		name: z.string().nullable(),
		email: z.string().nullable(),
		hasCompletedInitialOnboarding: z.boolean(),
	})
	.strict();

export type GetProfileInput = z.infer<typeof emptyInputSchema>;
export type ProfileInfo = z.infer<typeof profileInfoSchema>;
