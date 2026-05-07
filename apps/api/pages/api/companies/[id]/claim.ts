import type { NextApiRequest, NextApiResponse } from "next";
import { createApiError, requireAuthenticated } from "~/server/api-context";
import { createCompanyClaim } from "~/server/services/startup-navigator/companies";
import { assertMethod, firstQueryValue, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		assertMethod(req, ["POST"]);
		requireAuthenticated(ctx);
		if (!ctx.userId) throw createApiError("Unauthorized", 401);
		const companyId = firstQueryValue(req.query.id);
		if (!companyId) throw createApiError("Company id required", 400);
		return createCompanyClaim(ctx.db, ctx.userId, { ...req.body, companyId });
	});
}
