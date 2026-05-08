import type { AuthenticatedContext } from "../handler-wrappers";
import { withAuth } from "../handler-wrappers";
import {
	getLatestNavigatorPlan,
	listNavigatorPlans,
	saveNavigatorPlan,
} from "../services/startup-navigator/navigator-plans";

export const navigatorPlans = {
	save: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		return saveNavigatorPlan(ctx.db, ctx.userId, body);
	}),

	latest: withAuth(async (ctx: AuthenticatedContext) => {
		return getLatestNavigatorPlan(ctx.db, ctx.userId);
	}),

	list: withAuth(async (ctx: AuthenticatedContext) => {
		return listNavigatorPlans(ctx.db, ctx.userId);
	}),
};
