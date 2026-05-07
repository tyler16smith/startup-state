import type { NextApiRequest, NextApiResponse } from "next";
import {
	type ApiContext,
	createApiContext,
	createApiError,
} from "~/server/api-context";

export function firstQueryValue(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

export function assertMethod(req: NextApiRequest, methods: string[]) {
	if (!req.method || !methods.includes(req.method)) {
		throw createApiError("Method not allowed", 405);
	}
}

export async function respond(
	req: NextApiRequest,
	res: NextApiResponse,
	handler: (ctx: ApiContext) => Promise<unknown>,
) {
	try {
		const ctx = await createApiContext(req, res);
		const data = await handler(ctx);
		return res.status(200).json({ data });
	} catch (error) {
		const status =
			typeof error === "object" && error !== null && "status" in error
				? (error as { status: number }).status
				: 500;
		return res.status(status).json({
			error: {
				message:
					error instanceof Error ? error.message : "Internal server error",
			},
		});
	}
}
