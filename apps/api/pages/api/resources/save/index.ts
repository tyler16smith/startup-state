import type { NextApiRequest, NextApiResponse } from "next";
import { createApiError, requireAuthenticated } from "~/server/api-context";
import { saveResource } from "~/server/services/startup-navigator/resources";
import { savedResourceInputSchema } from "~/server/services/startup-navigator/schemas";
import { assertMethod, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		assertMethod(req, ["POST"]);
		requireAuthenticated(ctx);
		if (!ctx.userId) throw createApiError("Unauthorized", 401);
		const input = savedResourceInputSchema.parse(req.body);
		return saveResource(ctx.db, ctx.userId, input.resourceId);
	});
}
