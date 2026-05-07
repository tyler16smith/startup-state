import type { NextApiRequest, NextApiResponse } from "next";
import { createApiError, requireAuthenticated } from "~/server/api-context";
import {
	createCompany,
	searchCompanies,
} from "~/server/services/startup-navigator/companies";
import { assertMethod, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		if (req.method === "GET") return searchCompanies(ctx.db, req.query);
		assertMethod(req, ["POST"]);
		requireAuthenticated(ctx);
		if (!ctx.userId) throw createApiError("Unauthorized", 401);
		return createCompany(ctx.db, req.body, { submittedByUserId: ctx.userId });
	});
}
