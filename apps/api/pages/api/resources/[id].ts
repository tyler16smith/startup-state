import type { NextApiRequest, NextApiResponse } from "next";
import { getResourceById } from "~/server/services/startup-navigator/resources";
import { assertMethod, firstQueryValue, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		assertMethod(req, ["GET"]);
		const id = firstQueryValue(req.query.id);
		return getResourceById(ctx.db, { id, slug: id }, { userId: ctx.userId });
	});
}
