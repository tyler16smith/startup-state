import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "~/server/services/startup-navigator/authz";
import {
	createResource,
	searchResources,
} from "~/server/services/startup-navigator/resources";
import { assertMethod, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		await requireAdmin(ctx);
		if (req.method === "GET")
			return searchResources(ctx.db, req.query, {
				admin: true,
				userId: ctx.userId,
			});
		assertMethod(req, ["POST"]);
		return createResource(ctx.db, req.body);
	});
}
