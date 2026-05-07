import type { NextApiRequest, NextApiResponse } from "next";
import { createApiError, requireAuthenticated } from "~/server/api-context";
import { unsaveResource } from "~/server/services/startup-navigator/resources";
import { assertMethod, firstQueryValue, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		assertMethod(req, ["DELETE"]);
		requireAuthenticated(ctx);
		if (!ctx.userId) throw createApiError("Unauthorized", 401);
		const resourceId = firstQueryValue(req.query.resourceId);
		if (!resourceId) throw createApiError("Resource id required", 400);
		return unsaveResource(ctx.db, ctx.userId, resourceId);
	});
}
