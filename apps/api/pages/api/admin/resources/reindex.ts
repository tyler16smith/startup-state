import type { NextApiRequest, NextApiResponse } from "next";
import { createApiError } from "~/server/api-context";
import { requireAdmin } from "~/server/services/startup-navigator/authz";
import { assertMethod, respond } from "~/server/startup-rest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	return respond(req, res, async (ctx) => {
		assertMethod(req, ["POST"]);
		await requireAdmin(ctx);
		throw createApiError(
			"Bulk resource reindexing is not available until embedding generation is configured.",
			501,
		);
	});
}
