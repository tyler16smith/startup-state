import { withPublic } from "../handler-wrappers";
import { subscribeToNewsletter } from "../services/startup-navigator/newsletter";

export const newsletter = {
	subscribe: withPublic(async (ctx, body) => {
		return subscribeToNewsletter(ctx.db, ctx.userId, body);
	}),
};
