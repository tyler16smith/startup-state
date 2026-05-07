import type { NextApiRequest, NextApiResponse } from "next";
import { createApiError } from "~/server/api-context";
import { requireAdmin } from "~/server/services/startup-navigator/authz";
import { rejectCompanyClaim } from "~/server/services/startup-navigator/companies";
import { assertMethod, firstQueryValue, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		assertMethod(req, ["POST"]);
		await requireAdmin(ctx);
		if (!ctx.userId) throw createApiError("Unauthorized", 401);
		const claimId = firstQueryValue(req.query.id);
		if (!claimId) throw createApiError("Claim id required", 400);
		return rejectCompanyClaim(ctx.db, claimId, ctx.userId);
	});
}
