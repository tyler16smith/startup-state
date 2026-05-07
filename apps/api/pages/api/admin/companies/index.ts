import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "~/server/services/startup-navigator/authz";
import {
	createCompany,
	searchCompanies,
} from "~/server/services/startup-navigator/companies";
import { assertMethod, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		await requireAdmin(ctx);
		if (req.method === "GET")
			return searchCompanies(ctx.db, req.query, { admin: true });
		assertMethod(req, ["POST"]);
		return createCompany(ctx.db, req.body, { admin: true });
	});
}
