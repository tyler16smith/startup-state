import type { NextApiRequest, NextApiResponse } from "next";
import { createApiError } from "~/server/api-context";
import { requireAdmin } from "~/server/services/startup-navigator/authz";
import {
	archiveCompany,
	getCompanyById,
	updateCompany,
} from "~/server/services/startup-navigator/companies";
import { assertMethod, firstQueryValue, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		await requireAdmin(ctx);
		const id = firstQueryValue(req.query.id);
		if (!id) throw createApiError("Company id required", 400);
		if (req.method === "GET")
			return getCompanyById(ctx.db, { id, slug: id }, { admin: true });
		if (req.method === "PATCH") return updateCompany(ctx.db, id, req.body);
		assertMethod(req, ["DELETE"]);
		return archiveCompany(ctx.db, id);
	});
}
