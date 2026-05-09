import crypto from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { AgentError } from "../../../../../src/agent/errors";
import type { FinStreamEvent } from "../../../../../src/agent/events";
import { FinAgent } from "../../../../../src/agent/fin-agent";
import { logger } from "../../../../../src/lib/logger";
import { createApiContext } from "../../../../../src/server/api-context";
import { getSessionCookieDiagnostics } from "../../../../../src/server/lib/auth-diagnostics";
import {
	applyCorsHeaders,
	enforceOrigin,
} from "../../../../../src/server/lib/cors";
import { computeCsrfToken } from "../../../../../src/server/lib/csrf";

function hasSessionCookie(req: NextApiRequest): boolean {
	const cookie = req.headers.cookie;
	if (!cookie) return false;
	return (
		cookie.includes("authjs.session-token") ||
		cookie.includes("__Secure-authjs.session-token")
	);
}

function hasBearerToken(req: NextApiRequest): boolean {
	const authHeader = req.headers.authorization;
	return Boolean(authHeader?.startsWith("Bearer "));
}

function getHeaderValue(
	header: string | string[] | undefined,
): string | undefined {
	if (!header) return undefined;
	return Array.isArray(header) ? header[0] : header;
}

async function enforceCsrf(req: NextApiRequest): Promise<void> {
	const expected = await computeCsrfToken(req.headers.cookie ?? "");
	const received = getHeaderValue(req.headers["x-csrf-token"]);
	if (!received || received.length !== expected.length) {
		throw new Error("Invalid CSRF token");
	}
	if (
		!crypto.timingSafeEqual(
			Buffer.from(expected, "utf8"),
			Buffer.from(received, "utf8"),
		)
	) {
		throw new Error("Invalid CSRF token");
	}
}

export const config = {
	api: {
		bodyParser: {
			sizeLimit: "256kb",
		},
		responseLimit: false,
	},
};

const requestBodySchema = z.object({
	conversationId: z.string().min(1).optional(),
	message: z.string().min(1).max(20_000),
	clientRequestId: z.string().min(1).max(200).optional(),
	clientContext: z
		.object({
			currentRoute: z.string().optional(),
			activePage: z.string().optional(),
		})
		.optional(),
});

function writeSseEvent(res: NextApiResponse, event: FinStreamEvent): void {
	res.write(`event: ${event.type}\n`);
	res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function writeSseError(
	res: NextApiResponse,
	code: string,
	message: string,
): void {
	writeSseEvent(res, { type: "error", error: { code, message } });
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
): Promise<void> {
	const { origin, allowedOrigins, isAllowedOrigin } = applyCorsHeaders(
		req,
		res,
		"POST,OPTIONS",
	);

	if (req.method === "OPTIONS") {
		if (!isAllowedOrigin) {
			logger.warn("agent.chat.stream.cors_preflight_rejected", {
				feature: "agent",
				operation: "chat.stream",
				origin,
			});
			res.status(403).json({ error: { message: "Origin not allowed" } });
			return;
		}
		res.status(204).end();
		return;
	}

	if (req.method !== "POST") {
		res.setHeader("Allow", "POST, OPTIONS");
		res.status(405).json({ error: { message: "Method not allowed" } });
		return;
	}

	const hasBearerAuth = hasBearerToken(req);
	const hasSession = hasSessionCookie(req);
	logger.info("agent.chat.stream.request_received", {
		feature: "agent",
		operation: "chat.stream",
		origin,
		isAllowedOrigin,
		hasBearerAuth,
		hasSession,
		...getSessionCookieDiagnostics(req.headers.cookie),
	});

	if (!hasBearerAuth && hasSession) {
		try {
			enforceOrigin(req, allowedOrigins);
			await enforceCsrf(req);
		} catch (error) {
			logger.warn("agent.chat.stream.browser_security_rejected", {
				feature: "agent",
				operation: "chat.stream",
				origin,
				errorMessage: error instanceof Error ? error.message : "Unknown error",
			});
			res.status(403).json({
				error: {
					message: error instanceof Error ? error.message : "Forbidden",
				},
			});
			return;
		}
	} else if (!hasBearerAuth && origin) {
		try {
			enforceOrigin(req, allowedOrigins);
		} catch {
			res.status(403).json({ error: { message: "Origin not allowed" } });
			return;
		}
	}

	const ctx = await createApiContext(req, res);
	const userId = ctx.userId;
	if (!userId) {
		logger.warn("agent.chat.stream.unauthorized", {
			feature: "agent",
			operation: "chat.stream",
			origin,
			hasBearerAuth,
			hasSession,
			hasContextSession: Boolean(ctx.session),
			hasJwtPayload: Boolean(ctx.jwtPayload),
			...getSessionCookieDiagnostics(req.headers.cookie),
		});
		res.status(401).json({ error: { message: "Unauthorized" } });
		return;
	}

	const parsed = requestBodySchema.safeParse(req.body ?? {});
	if (!parsed.success) {
		res.status(400).json({
			error: {
				message: "Invalid request body",
				issues: parsed.error.issues,
			},
		});
		return;
	}

	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache, no-transform");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("X-Accel-Buffering", "no");
	if (typeof res.flushHeaders === "function") res.flushHeaders();

	const controller = new AbortController();
	let completed = false;
	const onClose = () => {
		if (!completed) {
			controller.abort(new AgentError("CANCELLED", "Client disconnected."));
		}
	};
	res.on("close", onClose);

	const wallTimeMs = Number(process.env.FIN_AGENT_MAX_WALL_TIME_MS ?? 60_000);
	const wallTimer = setTimeout(() => {
		controller.abort(
			new AgentError("TIMEOUT", "Agent run exceeded max wall time."),
		);
	}, wallTimeMs);

	try {
		const agent = new FinAgent();
		const stream = agent.run({
			userId,
			message: parsed.data.message,
			conversationId: parsed.data.conversationId,
			clientRequestId: parsed.data.clientRequestId,
			clientContext: parsed.data.clientContext,
			signal: controller.signal,
		});

		for await (const event of stream) {
			if (
				controller.signal.aborted &&
				controller.signal.reason instanceof AgentError &&
				controller.signal.reason.code === "CANCELLED"
			) {
				break;
			}
			writeSseEvent(res, event);
		}
	} catch (error) {
		logger.logError("agent.chat.stream.error", error, {
			feature: "agent",
			userId,
		});
		try {
			writeSseError(res, "PROVIDER_ERROR", "Something went wrong.");
		} catch {
			// ignore - res may be closed
		}
	} finally {
		clearTimeout(wallTimer);
		completed = true;
		res.off("close", onClose);
		try {
			res.end();
		} catch {
			// ignore
		}
	}
}
