import type { NextApiRequest, NextApiResponse } from "next";
import { getCompanyById } from "~/server/services/startup-navigator/companies";
import { assertMethod, firstQueryValue, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		assertMethod(req, ["GET"]);
		const id = firstQueryValue(req.query.id);
		return getCompanyById(ctx.db, { id, slug: id });
	});
}
