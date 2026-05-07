import type { NextApiRequest, NextApiResponse } from "next";
import { createApiError } from "~/server/api-context";
import { requireAdmin } from "~/server/services/startup-navigator/authz";
import {
	archiveResource,
	getResourceById,
	updateResource,
} from "~/server/services/startup-navigator/resources";
import { assertMethod, firstQueryValue, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		await requireAdmin(ctx);
		const id = firstQueryValue(req.query.id);
		if (!id) throw createApiError("Resource id required", 400);
		if (req.method === "GET")
			return getResourceById(
				ctx.db,
				{ id, slug: id },
				{ admin: true, userId: ctx.userId },
			);
		if (req.method === "PATCH") return updateResource(ctx.db, id, req.body);
		assertMethod(req, ["DELETE"]);
		return archiveResource(ctx.db, id);
	});
}
