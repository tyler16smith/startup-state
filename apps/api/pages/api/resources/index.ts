import type { NextApiRequest, NextApiResponse } from "next";
import { searchResources } from "~/server/services/startup-navigator/resources";
import { assertMethod, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		assertMethod(req, ["GET"]);
		return searchResources(ctx.db, req.query, { userId: ctx.userId });
	});
}
