import { z } from "zod";
import type { ApiContext } from "../api-context";
import { createApiError } from "../api-context";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import {
	createAuthSession,
	generateAccessToken,
	revokeSession,
	validateRefreshToken,
} from "../lib/token-manager";

const startInput = z.object({
	extensionId: z.string().min(1).optional(),
});

const exchangeInput = z.object({
	deviceInfo: z.string().optional(),
});

const refreshInput = z.object({
	refreshToken: z.string().min(1),
});

const revokeInput = z.object({
	sessionId: z.string().optional(),
});

function getWebOrigin(): string {
	return (
		process.env.WEB_ORIGIN ??
		process.env.NEXT_PUBLIC_WEB_URL ??
		"http://localhost:3000"
	).replace(/\/$/, "");
}

export const extensionAuth = {
	start: async (_ctx: ApiContext, body: unknown) => {
		const input = startInput.parse(body);
		const url = new URL("/extension/auth", getWebOrigin());
		if (input.extensionId)
			url.searchParams.set("extensionId", input.extensionId);

		return { authUrl: url.toString() };
	},

	exchange: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = exchangeInput.parse(body);
		const user = await ctx.db.user.findUnique({
			where: { id: ctx.userId },
			select: { id: true, email: true },
		});

		if (!user?.email) {
			throw createApiError("User not found", 404);
		}

		const ipAddress =
			(ctx.req.headers["x-forwarded-for"] as string | undefined) ??
			ctx.req.socket?.remoteAddress;
		const { sessionId, refreshToken, expiresAt } = await createAuthSession(
			user.id,
			input.deviceInfo ?? "App Chrome Extension",
			ipAddress,
		);
		const accessToken = generateAccessToken(user.id, user.email, sessionId);

		return {
			accessToken,
			refreshToken,
			expiresIn: 3600,
			expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
			refreshExpiresAt: expiresAt.toISOString(),
			tokenType: "Bearer",
			user: {
				id: user.id,
				email: user.email,
			},
		};
	}),

	refresh: async (ctx: ApiContext, body: unknown) => {
		const input = refreshInput.parse(body);
		const validated = await validateRefreshToken(input.refreshToken);

		if (!validated) {
			throw createApiError("Invalid or expired refresh token", 401);
		}

		const user = await ctx.db.user.findUnique({
			where: { id: validated.userId },
			select: { id: true, email: true },
		});

		if (!user?.email) {
			throw createApiError("User not found", 404);
		}

		const accessToken = generateAccessToken(
			user.id,
			user.email,
			validated.sessionId,
		);

		return {
			accessToken,
			expiresIn: 3600,
			tokenType: "Bearer",
			user: {
				id: user.id,
				email: user.email,
			},
		};
	},

	me: withAuth(async (ctx: AuthenticatedContext) => {
		const user = await ctx.db.user.findUnique({
			where: { id: ctx.userId },
			select: { id: true, email: true },
		});

		if (!user?.email) {
			throw createApiError("User not found", 404);
		}

		return {
			user: {
				id: user.id,
				email: user.email,
			},
		};
	}),

	revoke: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = revokeInput.parse(body);
		const sessionId = input.sessionId ?? ctx.jwtPayload?.sessionId;

		if (!sessionId) {
			throw createApiError("No extension session found", 400);
		}

		await revokeSession(sessionId);
		return { message: "Extension auth revoked" };
	}),
};
