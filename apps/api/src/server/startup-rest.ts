import crypto from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import {
	type ApiContext,
	createApiContext,
	createApiError,
} from "~/server/api-context";
import { applyCorsHeaders, enforceOrigin } from "~/server/lib/cors";
import { computeCsrfToken } from "~/server/lib/csrf";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function firstQueryValue(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

export function assertMethod(req: NextApiRequest, methods: string[]) {
	if (!req.method || !methods.includes(req.method)) {
		throw createApiError("Method not allowed", 405);
	}
}

function getHeaderValue(header: string | string[] | undefined) {
	return Array.isArray(header) ? header[0] : header;
}

function hasBearerToken(req: NextApiRequest) {
	return Boolean(req.headers.authorization?.startsWith("Bearer "));
}

function hasSessionCookie(req: NextApiRequest) {
	const cookieHeader = req.headers.cookie;
	return Boolean(
		cookieHeader?.includes("authjs.session-token") ||
			cookieHeader?.includes("__Secure-authjs.session-token"),
	);
}

async function enforceCsrf(req: NextApiRequest) {
	const expectedToken = await computeCsrfToken(req.headers.cookie ?? "");
	const receivedToken = getHeaderValue(req.headers["x-csrf-token"]);
	if (!receivedToken || receivedToken.length !== expectedToken.length) {
		throw createApiError("Invalid CSRF token", 403);
	}
	if (
		!crypto.timingSafeEqual(
			Buffer.from(expectedToken, "utf8"),
			Buffer.from(receivedToken, "utf8"),
		)
	) {
		throw createApiError("Invalid CSRF token", 403);
	}
}

async function enforceRestRequestSecurity(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	const { origin, allowedOrigins, isAllowedOrigin } = applyCorsHeaders(
		req,
		res,
	);

	if (req.method === "OPTIONS") {
		if (!isAllowedOrigin) throw createApiError("Origin not allowed", 403);
		return;
	}

	if (!req.method || !unsafeMethods.has(req.method)) return;
	if (hasBearerToken(req)) return;

	if (hasSessionCookie(req)) {
		enforceOrigin(req, allowedOrigins);
		await enforceCsrf(req);
		return;
	}

	if (origin) enforceOrigin(req, allowedOrigins);
}

export async function respond(
	req: NextApiRequest,
	res: NextApiResponse,
	handler: (ctx: ApiContext) => Promise<unknown>,
) {
	try {
		await enforceRestRequestSecurity(req, res);
		if (req.method === "OPTIONS") return res.status(204).end();
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
