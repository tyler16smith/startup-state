import crypto from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import {
	type ApiContext,
	createApiContext,
} from "../../../../src/server/api-context";
import { handlers } from "../../../../src/server/handlers";
import {
	applyCorsHeaders,
	enforceOrigin,
} from "../../../../src/server/lib/cors";
import { computeCsrfToken } from "../../../../src/server/lib/csrf";

type RouteHandler = (ctx: ApiContext, body?: unknown) => Promise<unknown>;

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const API_LOG_PREFIX = "[API][v1-router]";

export const config = {
	api: {
		bodyParser: {
			sizeLimit: "25mb",
		},
	},
};

function getBodyDiagnostics(body: unknown): Record<string, unknown> {
	if (typeof body === "string") {
		return { bodyType: "string", bodyLength: body.length };
	}

	if (typeof body === "object" && body !== null) {
		const record = body as Record<string, unknown>;
		return {
			bodyType: "object",
			bodyKeys: Object.keys(record),
			htmlLength:
				typeof record.html === "string" ? record.html.length : undefined,
			ordersLength: Array.isArray(record.orders)
				? record.orders.length
				: undefined,
		};
	}

	return { bodyType: typeof body };
}

function logApi(message: string, context: Record<string, unknown> = {}) {
	console.log(API_LOG_PREFIX, message, {
		...context,
		timestamp: new Date().toISOString(),
	});
}

function logApiError(
	message: string,
	error: unknown,
	context: Record<string, unknown> = {},
) {
	console.error(API_LOG_PREFIX, message, {
		...context,
		error:
			error instanceof Error
				? { name: error.name, message: error.message, stack: error.stack }
				: String(error),
		timestamp: new Date().toISOString(),
	});
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Check if request has Bearer token (token-based auth for native apps)
 */
function hasBearerToken(req: NextApiRequest): boolean {
	const authHeader = req.headers.authorization;
	return Boolean(authHeader?.startsWith("Bearer "));
}

/**
 * Check if request has session cookie (cookie-based auth for web browsers)
 */
function hasSessionCookie(req: NextApiRequest): boolean {
	const cookieHeader = req.headers.cookie;
	if (!cookieHeader) return false;

	// Check for NextAuth session cookie
	return (
		cookieHeader.includes("authjs.session-token") ||
		cookieHeader.includes("__Secure-authjs.session-token")
	);
}

/**
 * Get single header value from potentially array header
 */
function getHeaderValue(
	header: string | string[] | undefined,
): string | undefined {
	if (!header) return undefined;
	return Array.isArray(header) ? header[0] : header;
}

/**
 * Enforce per-session CSRF protection for browser requests.
 * Validates the x-csrf-token header against an HMAC of the session token.
 * Only called for cookie-based auth (browser clients) on unsafe methods.
 */
async function enforceCsrf(req: NextApiRequest): Promise<void> {
	const expectedToken = await computeCsrfToken(req.headers.cookie ?? "");
	const receivedToken = getHeaderValue(req.headers["x-csrf-token"]);

	if (!receivedToken || receivedToken.length !== expectedToken.length) {
		throw new Error("Invalid CSRF token");
	}

	// Constant-time comparison to prevent timing attacks
	if (
		!crypto.timingSafeEqual(
			Buffer.from(expectedToken, "utf8"),
			Buffer.from(receivedToken, "utf8"),
		)
	) {
		throw new Error("Invalid CSRF token");
	}
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	const requestStartedAt = performance.now();
	const { origin, allowedOrigins, isAllowedOrigin } = applyCorsHeaders(
		req,
		res,
	);

	// Handle CORS preflight
	if (req.method === "OPTIONS") {
		if (!isAllowedOrigin) {
			console.warn("[API] CORS preflight rejected:", {
				origin,
				allowedOrigins,
			});
			return res.status(403).json({ error: { message: "Origin not allowed" } });
		}
		return res.status(204).end();
	}

	const method = req.method ?? "GET";
	const isUnsafeMethod = UNSAFE_METHODS.has(method);

	// ─── Auth Flow Decision ───────────────────────────────────────────────────

	// Decision: Determine auth mechanism based on what credentials are present
	// - Bearer token = token-based auth (mobile/API clients)
	// - Session cookie = cookie-based auth (web browsers)
	// - Neither = unauthenticated (may be allowed for some endpoints)

	const hasBearerAuth = hasBearerToken(req);
	const hasSession = hasSessionCookie(req);

	logApi("Request received", {
		method,
		router: req.query.router,
		action: req.query.action,
		origin,
		isAllowedOrigin,
		hasBearerAuth,
		hasSession,
		contentType: req.headers["content-type"],
		contentLength: req.headers["content-length"],
		userAgent: req.headers["user-agent"],
		...getBodyDiagnostics(req.body),
	});
	// For unsafe methods, enforce appropriate security based on auth mechanism
	if (isUnsafeMethod) {
		if (hasBearerAuth) {
			// ─── Token-Based Auth Flow (Mobile/API) ───────────────────────────

			// Token-based clients (mobile apps, API clients):
			// - Use Bearer tokens for authentication
			// - Do NOT send Origin headers (not browsers)
			// - Do NOT need CSRF protection (token is not sent automatically)
			// - Token validation happens in createApiContext

			console.log("[API] Token-based auth request:", {
				method,
				router: req.query.router,
				action: req.query.action,
				hasOrigin: Boolean(origin),
				userAgent: req.headers["user-agent"], // For debugging only
			});

			// Bearer token validation happens in createApiContext
			// No Origin or CSRF checks needed for token-based auth
		} else if (hasSession) {
			// ─── Cookie-Based Auth Flow (Web Browser) ─────────────────────────

			// Cookie-based clients (web browsers):
			// - Use session cookies for authentication
			// - MUST send Origin header (browsers do this automatically)
			// - MUST pass CSRF protection (cookies sent automatically = CSRF risk)
			// - Session validation happens in createApiContext

			console.log("[API] Cookie-based auth request:", {
				method,
				router: req.query.router,
				action: req.query.action,
				origin,
				isAllowedOrigin,
				userAgent: req.headers["user-agent"], // For debugging only
			});

			// Enforce browser security: Origin + CSRF
			try {
				enforceOrigin(req, allowedOrigins);
				await enforceCsrf(req);
			} catch (error) {
				console.warn("[API] Browser security check failed:", {
					method,
					router: req.query.router,
					action: req.query.action,
					origin,
					error: error instanceof Error ? error.message : "Unknown",
				});
				return res.status(403).json({
					error: {
						message: error instanceof Error ? error.message : "Forbidden",
					},
				});
			}
		} else {
			// ─── No Auth Present ──────────────────────────────────────────────

			// No authentication credentials found
			// This may be allowed for public endpoints (e.g., /auth/register, /auth/exchange)
			// The route handler will enforce authentication if required

			console.log("[API] Unauthenticated request:", {
				method,
				router: req.query.router,
				action: req.query.action,
				origin,
				userAgent: req.headers["user-agent"], // For debugging only
			});

			// For unauthenticated requests from browsers, still enforce Origin
			if (origin) {
				try {
					enforceOrigin(req, allowedOrigins);
					// Note: CSRF not enforced here since there's no session to protect
				} catch (_error) {
					console.warn(
						"[API] Origin check failed for unauthenticated request:",
						{
							origin,
							allowedOrigins,
						},
					);
					return res.status(403).json({
						error: { message: "Origin not allowed" },
					});
				}
			}
		}
	}

	// ─── Route Handler ────────────────────────────────────────────────────────

	const { router, action } = req.query;

	if (Array.isArray(router) || Array.isArray(action)) {
		return res.status(400).json({ error: "Invalid router or action." });
	}

	const stringRouter = String(router ?? "");
	const stringAction = String(action ?? "");

	const routerHandlers = handlers as Record<
		string,
		Record<string, RouteHandler>
	>;
	const routeHandler = routerHandlers[stringRouter]?.[stringAction];

	if (!routeHandler) {
		return res.status(404).json({ error: "Router or action not found." });
	}

	try {
		// createApiContext validates tokens/sessions and attaches user to context
		const ctx = await createApiContext(req, res);
		logApi("API context created", {
			router: stringRouter,
			action: stringAction,
			hasUserId: Boolean(ctx.userId),
			hasSession: Boolean(ctx.session),
			hasJwtPayload: Boolean(ctx.jwtPayload),
		});
		const body =
			req.method === "GET"
				? req.query
				: {
						...(req.query ?? {}),
						...(typeof req.body === "object" && req.body !== null
							? req.body
							: {}),
					};
		logApi("Route handler invoking", {
			router: stringRouter,
			action: stringAction,
			...getBodyDiagnostics(body),
		});
		const result = await routeHandler(ctx, body);
		const durationMs = Math.round(performance.now() - requestStartedAt);
		logApi("Route handler completed", {
			router: stringRouter,
			action: stringAction,
			durationMs,
		});
		return res.status(200).json({ data: result });
	} catch (error) {
		const durationMs = Math.round(performance.now() - requestStartedAt);
		logApiError("Route handler failed", error, {
			router: stringRouter,
			action: stringAction,
			durationMs,
		});
		// Log errors (but not sensitive data)
		console.error("[API] Handler error:", {
			router: stringRouter,
			action: stringAction,
			error: error instanceof Error ? error.message : "Unknown error",
			status:
				typeof error === "object" && error !== null && "status" in error
					? (error as { status: number }).status
					: 500,
		});

		const status =
			typeof error === "object" && error !== null && "status" in error
				? (error as { status: number }).status
				: 500;
		const isProd = process.env.NODE_ENV === "production";
		const message =
			isProd && status >= 500
				? "Internal server error"
				: error instanceof Error
					? error.message
					: "Internal server error";
		return res.status(status ?? 500).json({ error: { message } });
	}
}
