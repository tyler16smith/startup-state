import type { NextApiRequest, NextApiResponse } from "next";
// Temporarily disabled: import { auth } from "~/server/auth";
import type { Session } from "next-auth";
import { decode } from "next-auth/jwt";

import { logger } from "~/lib/logger";
import { db } from "./db";
import { validateAccessToken } from "./lib/token-manager";

// Temporarily disabled: import { resolveActiveUserId } from "~/server/context/resolve-active-context";

type JWTPayload = {
	userId: string;
	email: string;
	sessionId: string;
	iat: number;
	exp: number;
};

function parseCookieHeader(cookieHeader: string): Record<string, string> {
	const cookies: Record<string, string> = {};
	for (const part of cookieHeader.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key) cookies[key.trim()] = decodeURIComponent(rest.join("=").trim());
	}
	return cookies;
}

function getHeaderValue(
	header: string | string[] | undefined,
): string | undefined {
	if (Array.isArray(header)) {
		return header[0];
	}
	return header;
}

async function validateJWT(token: string): Promise<JWTPayload | null> {
	try {
		const decoded = validateAccessToken(token);
		if (!decoded) return null;

		// Verify user still exists
		const user = await db.user.findUnique({
			where: { id: decoded.userId },
			select: { id: true, email: true },
		});

		if (!user) return null;

		return {
			userId: decoded.userId,
			email: decoded.email,
			sessionId: decoded.sessionId,
			iat: 0, // Not used, but kept for type compatibility
			exp: 0, // Not used, but kept for type compatibility
		};
	} catch {
		return null;
	}
}

/**
 * Extract user ID from NextAuth JWT session cookie
 * This is a temporary workaround until we extract auth to shared package
 */
async function getUserIdFromSessionCookie(
	cookies: Record<string, string>,
): Promise<string | null> {
	try {
		// NextAuth v5 uses JWT sessions by default
		const sessionToken =
			cookies["authjs.session-token"] ||
			cookies["__Secure-authjs.session-token"];

		if (!sessionToken) {
			return null;
		}

		if (!process.env.AUTH_SECRET) {
			logger.error("AUTH_SECRET is not set", {
				feature: "auth",
				operation: "getSession",
			});
			return null;
		}

		// Determine the correct salt based on the cookie name being used
		// In production, NextAuth uses __Secure- prefix
		const isSecure = "__Secure-authjs.session-token" in cookies;
		const salt = isSecure
			? "__Secure-authjs.session-token"
			: "authjs.session-token";

		// Decode the NextAuth JWT using the AUTH_SECRET
		const decoded = await decode({
			token: sessionToken,
			secret: process.env.AUTH_SECRET,
			salt,
		});

		const userId = (decoded?.sub as string | undefined) ?? null;
		return userId;
	} catch (error) {
		logger.logError("Error reading session cookie", error, {
			feature: "auth",
			operation: "getSession",
		});
		return null;
	}
}

export type ApiContext = {
	db: typeof db;
	session: Session | null;
	jwtPayload: JWTPayload | null; // For mobile auth
	isDemoMode: boolean;
	demoOverlaySessionKey: string | null;
	userId: string | null;
	req: NextApiRequest;
	res: NextApiResponse;
};

export async function createApiContext(
	req: NextApiRequest,
	res: NextApiResponse,
): Promise<ApiContext> {
	// Parse cookies early - needed for both auth and demo mode
	const cookieHeader = req.headers.cookie ?? "";
	const cookies = parseCookieHeader(cookieHeader);

	// Cookie parsing and session resolution

	// Try to get userId from NextAuth session cookie
	const sessionUserId = await getUserIdFromSessionCookie(cookies);

	// Check for JWT token (for mobile apps)
	const authHeader = req.headers.authorization;
	let jwtPayload: JWTPayload | null = null;

	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.substring(7); // Remove "Bearer " prefix
		jwtPayload = await validateJWT(token);
	}

	// Parse demo mode from cookies
	const demoContextHeader = getHeaderValue(req.headers["x-active-app-context"]);
	const demoSessionHeader = getHeaderValue(
		req.headers["x-demo-overlay-session-key"],
	);
	const isDemoMode =
		cookies.activeAppContext === "demo" || demoContextHeader === "demo";
	const demoOverlaySessionKey =
		cookies.demoOverlaySessionKey ?? demoSessionHeader ?? null;

	// Resolve userId: prefer session, then JWT, then null
	const userId = sessionUserId ?? jwtPayload?.userId ?? null;

	// Create a minimal session object if we have a userId from cookie
	const session = sessionUserId
		? ({ user: { id: sessionUserId } } as Session)
		: null;

	const context = {
		db,
		session,
		jwtPayload,
		isDemoMode,
		demoOverlaySessionKey,
		userId,
		req,
		res,
	};

	return context;
}

type ApiError = Error & { status: number };

export function createApiError(message: string, status: number): ApiError {
	const err = new Error(message) as ApiError;
	err.status = status;
	return err;
}

export function requireAuthenticated(ctx: ApiContext) {
	if (!ctx.session?.user && !ctx.jwtPayload) {
		throw createApiError("Unauthorized", 401);
	}
}

export function requireDemoOrAuthenticated(ctx: ApiContext) {
	if (!ctx.session?.user && !ctx.jwtPayload && !ctx.isDemoMode) {
		throw createApiError("Unauthorized", 401);
	}
}
