import crypto from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { AgentError, toAgentError } from "../../../../../src/agent/errors";
import type { FinStreamEvent } from "../../../../../src/agent/events";
import { RunStepStore } from "../../../../../src/agent/persistence/run-step-store";
import { RunStore } from "../../../../../src/agent/persistence/run-store";
import {
	executeWidgetAction,
	widgetActionStreamInputSchema,
} from "../../../../../src/agent/widgets/action-executor";
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

function writeSseEvent(res: NextApiResponse, event: FinStreamEvent): void {
	res.write(`event: ${event.type}\n`);
	res.write(`data: ${JSON.stringify(event)}\n\n`);
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
	logger.info("agent.widget_action.stream.request_received", {
		feature: "agent",
		operation: "widget_action.stream",
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
			logger.warn("agent.widget_action.browser_security_rejected", {
				feature: "agent",
				operation: "widget_action.stream",
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
		logger.warn("agent.widget_action.stream.unauthorized", {
			feature: "agent",
			operation: "widget_action.stream",
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

	const parsed = widgetActionStreamInputSchema.safeParse(req.body ?? {});
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

	const runStore = new RunStore(ctx.db);
	const stepStore = new RunStepStore(ctx.db);
	let runId: string | undefined;
	let stepId: string | undefined;

	try {
		const run = await runStore.createRun({
			userId,
			conversationId: parsed.data.conversationId,
			clientRequestId: parsed.data.clientRequestId,
			kind: "widget_action",
		});
		runId = run.id;
		await runStore.markRunning({ runId });
		writeSseEvent(res, {
			type: "run_started",
			conversationId: parsed.data.conversationId,
			runId,
		});

		const step = await stepStore.createStep({
			runId,
			stepIndex: 0,
			type: "tool_execution",
			input: {
				widgetId: parsed.data.widgetId,
				actionType: parsed.data.actionType,
			},
		});
		stepId = step.id;
		writeSseEvent(res, {
			type: "run_step_started",
			runId,
			stepId,
			stepIndex: 0,
			stepType: "tool_execution",
		});

		const emittedEvents: FinStreamEvent[] = [];
		const result = await executeWidgetAction({
			...parsed.data,
			userId,
			runId,
			stepId,
			abortSignal: controller.signal,
			emit: (event) => {
				emittedEvents.push(event);
			},
		});

		for (const event of emittedEvents) writeSseEvent(res, event);

		await stepStore.completeStep({ stepId, output: result });
		writeSseEvent(res, {
			type: "run_step_done",
			runId,
			stepId,
			stepIndex: 0,
			stepType: "tool_execution",
		});

		if (
			result &&
			typeof result === "object" &&
			"status" in result &&
			result.status === "waiting_for_user"
		) {
			await ctx.db.agentRun.update({
				where: { id: runId },
				data: { status: "waiting_for_user", completedAt: new Date() },
			});
		} else {
			await runStore.completeRun({ runId });
		}
	} catch (error) {
		const agentError = toAgentError(error);
		logger.logError("agent.widget_action.stream.error", agentError, {
			feature: "agent",
			userId,
			runId,
			stepId,
			errorCode: agentError.code,
		});
		if (stepId) {
			await stepStore
				.failStep({ stepId, code: agentError.code, error: agentError })
				.catch(() => undefined);
		}
		if (runId) {
			if (agentError.code === "CANCELLED") {
				await runStore
					.cancelRun({ runId, reason: agentError.message })
					.catch(() => undefined);
				writeSseEvent(res, { type: "run_cancelled", runId });
			} else {
				await runStore
					.failRun({ runId, code: agentError.code, error: agentError })
					.catch(() => undefined);
				writeSseEvent(res, {
					type: "error",
					runId,
					stepId,
					error: {
						code: agentError.code,
						message: agentError.clientMessage,
					},
				});
			}
		} else {
			writeSseEvent(res, {
				type: "error",
				error: {
					code: agentError.code,
					message: agentError.clientMessage,
				},
			});
		}
	} finally {
		completed = true;
		res.off("close", onClose);
		try {
			res.end();
		} catch {
			// ignore
		}
	}
}
