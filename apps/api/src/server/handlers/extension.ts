import { type AuthenticatedContext, withAuth } from "../handler-wrappers";

export const extension = {
	helloWorld: withAuth(async (ctx: AuthenticatedContext) => {
		const user = await ctx.db.user.findUnique({
			where: { id: ctx.userId },
			select: { id: true, name: true, email: true },
		});

		return {
			message: "hello_world",
			source: "api",
			user: user
				? {
						id: user.id,
						name: user.name,
						email: user.email,
					}
				: null,
			receivedAt: new Date().toISOString(),
		};
	}),
};
