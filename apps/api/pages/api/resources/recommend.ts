import type { NextApiRequest, NextApiResponse } from "next";
import { recommendResourcesForFounderProfile } from "~/server/services/startup-navigator/resources";
import { assertMethod, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		assertMethod(req, ["POST"]);
		return recommendResourcesForFounderProfile(ctx.db, req.body, {
			userId: ctx.userId,
			persistProfile: Boolean(ctx.userId),
		});
	});
}
