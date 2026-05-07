import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "~/server/services/startup-navigator/authz";
import { importResourcesFromCsv } from "~/server/services/startup-navigator/resources";
import { assertMethod, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		assertMethod(req, ["POST"]);
		await requireAdmin(ctx);
		return importResourcesFromCsv(ctx.db, req.body);
	});
}
