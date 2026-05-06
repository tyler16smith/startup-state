import bcryptjs from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { logger } from "~/lib/logger";
import type { ApiContext } from "../api-context";
import { createApiError } from "../api-context";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import { verifyAppleIdentityToken } from "../lib/apple-auth";
import { computeCsrfToken } from "../lib/csrf";
import {
	createAuthSession,
	generateAccessToken,
	getUserSessions,
	revokeAllUserTokens,
	revokeSession,
	validateRefreshToken,
} from "../lib/token-manager";

// ─── Google OAuth Client ──────────────────────────────────────────────────────

const googleClient = new OAuth2Client(process.env.AUTH_GOOGLE_ID);

function getGoogleAllowedAudiences() {
	return [
		process.env.AUTH_GOOGLE_ID,
		process.env.AUTH_GOOGLE_ID_IOS,
		process.env.AUTH_GOOGLE_ID_ANDROID,
	].filter((id): id is string => id !== undefined);
}

async function verifyGoogleIdToken(
	idToken: string,
	audiences = getGoogleAllowedAudiences(),
) {
	if (audiences.length === 0) {
		throw createApiError("Google authentication is not configured", 500);
	}

	try {
		return await googleClient.verifyIdToken({
			idToken,
			audience: audiences,
		});
	} catch (error) {
		logger.warn("Google ID token verification failed", {
			feature: "auth",
			operation: "google.verify_id_token",
			configuredAudienceCount: audiences.length,
			errorMessage: error instanceof Error ? error.message : "Unknown error",
		});
		throw createApiError("Invalid Google ID token", 401);
	}
}

// ─── Input Schemas ────────────────────────────────────────────────────────────

const registerInput = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.string().email("Invalid email"),
	password: z.string().min(8, "Password must be at least 8 characters"),
	referralCode: z.string().optional(),
});

const exchangeInput = z.object({
	type: z.enum(["credentials", "google", "apple", "session"]),
	// For credentials
	email: z.string().email().optional(),
	password: z.string().optional(),
	// For OAuth providers
	idToken: z.string().optional(),
	name: z.string().optional(),
	authCode: z.string().optional(),
	redirectUri: z.string().optional(), // Required when using authCode
	// For 2FA
	twoFactorToken: z.string().optional(),
	// Device info for session tracking
	deviceInfo: z.string().optional(),
});

const nextAuthCredentialsInput = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

const nextAuthGoogleInput = z.object({
	idToken: z.string().min(1),
});

const refreshInput = z.object({
	refreshToken: z.string().min(1),
});

const revokeInput = z.object({
	sessionId: z.string().optional(),
	allDevices: z.boolean().default(false),
});

// ─── Handler Implementation ───────────────────────────────────────────────────

export const auth = {
	/**
	 * Validate credentials for the web NextAuth credentials provider.
	 * POST /api/v1/auth/nextAuthCredentials
	 */
	nextAuthCredentials: async (ctx: ApiContext, body: unknown) => {
		const input = nextAuthCredentialsInput.parse(body);

		const user = await ctx.db.user.findUnique({
			where: { email: input.email },
			select: {
				id: true,
				email: true,
				name: true,
				image: true,
				password: true,
				twoFactorEnabled: true,
				twoFactorVerified: true,
			},
		});

		if (!user?.password) {
			throw createApiError("Invalid credentials", 401);
		}

		const passwordMatch = await bcryptjs.compare(input.password, user.password);

		if (!passwordMatch) {
			throw createApiError("Invalid credentials", 401);
		}

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			image: user.image,
			twoFactorEnabled: user.twoFactorEnabled && user.twoFactorVerified,
		};
	},

	/**
	 * Resolve a Google identity for the web NextAuth Google provider.
	 * POST /api/v1/auth/nextAuthGoogle
	 */
	nextAuthGoogle: async (ctx: ApiContext, body: unknown) => {
		const input = nextAuthGoogleInput.parse(body);

		const ticket = await verifyGoogleIdToken(input.idToken);

		const payload = ticket.getPayload();
		if (!payload?.email) {
			throw createApiError("Invalid Google ID token", 401);
		}

		const email = payload.email;
		const user = await ctx.db.user.upsert({
			where: { email },
			create: {
				email,
				name: payload.name ?? email.split("@")[0],
				emailVerified: new Date(),
				image: payload.picture,
			},
			update: {
				name: payload.name,
				image: payload.picture,
				emailVerified: payload.email_verified ? new Date() : undefined,
			},
			select: {
				id: true,
				email: true,
				name: true,
				image: true,
				twoFactorEnabled: true,
				twoFactorVerified: true,
			},
		});

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			image: user.image,
			twoFactorEnabled: user.twoFactorEnabled && user.twoFactorVerified,
		};
	},

	/**
	 * Register a new user with credentials
	 * POST /api/v1/auth/register
	 */
	register: async (ctx: ApiContext, body: unknown) => {
		const input = registerInput.parse(body);
		const normalizedReferralCode = input.referralCode?.trim().toUpperCase();

		const existing = await ctx.db.user.findUnique({
			where: { email: input.email },
		});

		if (existing) {
			throw new Error("An account with this email already exists.");
		}

		const hashed = await bcryptjs.hash(input.password, 12);

		const referrer = normalizedReferralCode
			? await ctx.db.user.findUnique({
					where: { referralCode: normalizedReferralCode },
					select: { id: true },
				})
			: null;

		const user = await ctx.db.user.create({
			data: {
				name: input.name,
				email: input.email,
				password: hashed,
				referredByUserId: referrer?.id,
			},
			select: { id: true, email: true, name: true },
		});

		return user;
	},

	/**
	 * Exchange credentials or OAuth token for access + refresh tokens
	 * POST /api/v1/auth/exchange
	 *
	 * This is the unified auth endpoint for all platforms (web, iOS, Android).
	 * - For credentials: validates email/password
	 * - For OAuth: validates ID token from native SDK
	 * - Returns 2FA challenge if user has 2FA enabled
	 */
	exchange: async (ctx: ApiContext, body: unknown) => {
		const input = exchangeInput.parse(body);

		let userId: string;
		let email: string;

		if (input.type === "google") {
			let googleEmail: string;
			let googleName: string | undefined;
			let googlePicture: string | undefined;

			if (input.idToken) {
				// Verify the Google ID token (from native apps or web)
				// Support multiple client IDs: web, iOS, Android
				const ticket = await verifyGoogleIdToken(input.idToken);

				const payload = ticket.getPayload();
				if (!payload?.email) {
					throw new Error("Invalid Google ID token: no email found");
				}

				googleEmail = payload.email;
				googleName = payload.name;
				googlePicture = payload.picture;
			} else if (input.authCode && input.redirectUri) {
				// Exchange authorization code for tokens (from web-based OAuth flow)
				const { tokens } = await googleClient.getToken({
					code: input.authCode,
					redirect_uri: input.redirectUri,
				});

				if (!tokens.id_token) {
					throw new Error("No ID token returned from Google token exchange");
				}

				// Verify the exchanged ID token
				const ticket = await verifyGoogleIdToken(
					tokens.id_token,
					process.env.AUTH_GOOGLE_ID ? [process.env.AUTH_GOOGLE_ID] : [],
				);

				const payload = ticket.getPayload();
				if (!payload?.email) {
					throw new Error("Invalid Google ID token: no email found");
				}

				googleEmail = payload.email;
				googleName = payload.name;
				googlePicture = payload.picture;
			} else {
				throw new Error(
					"Either idToken or (authCode + redirectUri) is required for Google authentication",
				);
			}

			// Check if user exists, create if not
			let user = await ctx.db.user.findUnique({
				where: { email: googleEmail },
				select: {
					id: true,
					email: true,
					twoFactorEnabled: true,
					twoFactorVerified: true,
				},
			});

			if (!user) {
				// Create new user from Google account
				user = await ctx.db.user.create({
					data: {
						email: googleEmail,
						name: googleName ?? googleEmail.split("@")[0],
						emailVerified: new Date(), // Google emails are verified
						image: googlePicture,
					},
					select: {
						id: true,
						email: true,
						twoFactorEnabled: true,
						twoFactorVerified: true,
					},
				});
			}

			// Check if 2FA is required
			const requires2FA = user.twoFactorEnabled && user.twoFactorVerified;
			if (requires2FA && !input.twoFactorToken) {
				return {
					requires2FA: true,
					userId: user.id,
					message: "2FA verification required",
				};
			}

			// Verify 2FA token if provided
			if (requires2FA && input.twoFactorToken) {
				const { verifyTOTPToken } = await import("../auth/two-factor-utils");
				const twoFactorSecret = await ctx.db.user.findUnique({
					where: { id: user.id },
					select: { twoFactorSecret: true },
				});

				if (!twoFactorSecret?.twoFactorSecret) {
					throw new Error("2FA not properly configured");
				}

				const isValid = verifyTOTPToken(
					input.twoFactorToken,
					twoFactorSecret.twoFactorSecret,
				);
				if (!isValid) {
					throw new Error("Invalid 2FA token");
				}
			}

			userId = user.id;
			email = user.email ?? googleEmail;
		} else if (input.type === "apple") {
			if (!input.idToken) {
				throw new Error("idToken is required for Apple authentication");
			}

			const appleIdentity = await verifyAppleIdentityToken(input.idToken);
			const appleEmail = appleIdentity.email.toLowerCase();

			let user = await ctx.db.user.findUnique({
				where: { email: appleEmail },
				select: {
					id: true,
					email: true,
					twoFactorEnabled: true,
					twoFactorVerified: true,
				},
			});

			if (!user) {
				user = await ctx.db.user.create({
					data: {
						email: appleEmail,
						name:
							input.name?.trim() || appleEmail.split("@")[0] || "Apple User",
						emailVerified: appleIdentity.emailVerified ? new Date() : null,
					},
					select: {
						id: true,
						email: true,
						twoFactorEnabled: true,
						twoFactorVerified: true,
					},
				});
			}

			const requires2FA = user.twoFactorEnabled && user.twoFactorVerified;
			if (requires2FA && !input.twoFactorToken) {
				return {
					requires2FA: true,
					userId: user.id,
					message: "2FA verification required",
				};
			}

			if (requires2FA && input.twoFactorToken) {
				const { verifyTOTPToken } = await import("../auth/two-factor-utils");
				const twoFactorSecret = await ctx.db.user.findUnique({
					where: { id: user.id },
					select: { twoFactorSecret: true },
				});

				if (!twoFactorSecret?.twoFactorSecret) {
					throw new Error("2FA not properly configured");
				}

				const isValid = verifyTOTPToken(
					input.twoFactorToken,
					twoFactorSecret.twoFactorSecret,
				);
				if (!isValid) {
					throw new Error("Invalid 2FA token");
				}
			}

			userId = user.id;
			email = user.email ?? appleEmail;
		} else if (input.type === "session") {
			// Session exchange: for web app after NextAuth authentication
			// The API validates the NextAuth session cookie and issues API tokens
			// User must already be authenticated via NextAuth session cookie
			if (!ctx.userId) {
				throw new Error(
					"No valid session found. Please sign in first via the web app.",
				);
			}

			// Get user details
			const user = await ctx.db.user.findUnique({
				where: { id: ctx.userId },
				select: {
					id: true,
					email: true,
					twoFactorEnabled: true,
					twoFactorVerified: true,
				},
			});

			if (!user?.email) {
				throw new Error("User not found");
			}

			// Check if 2FA verification is pending
			const requires2FA = user.twoFactorEnabled && user.twoFactorVerified;
			// For session exchange, we trust NextAuth has already verified 2FA
			// (via the verify-2fa page flow), but we can add token verification if provided
			if (requires2FA && input.twoFactorToken) {
				const { verifyTOTPToken } = await import("../auth/two-factor-utils");
				const twoFactorSecret = await ctx.db.user.findUnique({
					where: { id: user.id },
					select: { twoFactorSecret: true },
				});

				if (twoFactorSecret?.twoFactorSecret) {
					const isValid = verifyTOTPToken(
						input.twoFactorToken,
						twoFactorSecret.twoFactorSecret,
					);
					if (!isValid) {
						throw new Error("Invalid 2FA token");
					}
				}
			}

			userId = user.id;
			email = user.email;
		} else if (input.type === "credentials") {
			if (!input.email || !input.password) {
				throw new Error(
					"email and password are required for credentials login",
				);
			}

			const user = await ctx.db.user.findUnique({
				where: { email: input.email },
				select: {
					id: true,
					email: true,
					password: true,
					twoFactorEnabled: true,
					twoFactorVerified: true,
				},
			});

			if (!user?.password) {
				throw new Error("Invalid credentials");
			}

			const passwordMatch = await bcryptjs.compare(
				input.password,
				user.password,
			);

			if (!passwordMatch) {
				throw new Error("Invalid credentials");
			}

			// Check if 2FA is required
			const requires2FA = user.twoFactorEnabled && user.twoFactorVerified;
			if (requires2FA && !input.twoFactorToken) {
				return {
					requires2FA: true,
					userId: user.id,
					message: "2FA verification required",
				};
			}

			// If 2FA is required and token is provided, verify it
			if (requires2FA && input.twoFactorToken) {
				const { verifyTOTPToken } = await import("../auth/two-factor-utils");
				const twoFactorSecret = await ctx.db.user.findUnique({
					where: { id: user.id },
					select: { twoFactorSecret: true },
				});

				if (!twoFactorSecret?.twoFactorSecret) {
					throw new Error("2FA not properly configured");
				}

				const isValid = verifyTOTPToken(
					input.twoFactorToken,
					twoFactorSecret.twoFactorSecret,
				);
				if (!isValid) {
					throw new Error("Invalid 2FA token");
				}
			}

			userId = user.id;
			email = user.email ?? input.email;
		} else {
			throw new Error("Unsupported authentication type");
		}

		// Generate tokens with session tracking
		const ipAddress =
			(ctx.req.headers["x-forwarded-for"] as string | undefined) ??
			ctx.req.socket?.remoteAddress;
		const { sessionId, refreshToken, expiresAt } = await createAuthSession(
			userId,
			input.deviceInfo,
			ipAddress,
		);

		const accessToken = generateAccessToken(userId, email, sessionId);

		return {
			accessToken,
			refreshToken,
			expiresIn: 3600, // 1 hour in seconds
			refreshExpiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
			tokenType: "Bearer",
			user: {
				id: userId,
				email,
			},
		};
	},

	/**
	 * Refresh an access token using a refresh token
	 * POST /api/v1/auth/refresh
	 */
	refresh: async (ctx: ApiContext, body: unknown) => {
		const input = refreshInput.parse(body);

		const validated = await validateRefreshToken(input.refreshToken);

		if (!validated) {
			throw new Error("Invalid or expired refresh token");
		}

		// Get user details
		const user = await ctx.db.user.findUnique({
			where: { id: validated.userId },
			select: { id: true, email: true },
		});

		if (!user?.email) {
			throw new Error("User not found");
		}

		// Generate new access token with session ID
		const accessToken = generateAccessToken(
			user.id,
			user.email,
			validated.sessionId,
		);

		return {
			accessToken,
			expiresIn: 3600, // 1 hour in seconds
			tokenType: "Bearer",
		};
	},

	/**
	 * Revoke session(s) (logout)
	 * POST /api/v1/auth/revoke
	 */
	revoke: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = revokeInput.parse(body);

		if (input.allDevices) {
			// Revoke all sessions for this user
			await revokeAllUserTokens(ctx.userId);
			return { message: "All devices logged out successfully" };
		}

		if (input.sessionId) {
			// Revoke specific session
			await revokeSession(input.sessionId);
			return { message: "Session revoked successfully" };
		}

		throw new Error("Either sessionId or allDevices must be specified");
	}),

	/**
	 * Get active sessions for current user
	 * GET /api/v1/auth/sessions
	 */
	sessions: withAuth(async (ctx: AuthenticatedContext) => {
		const sessions = await getUserSessions(ctx.userId);

		return {
			userId: ctx.userId,
			activeSessions: sessions.length,
			sessions: sessions.map((s) => ({
				id: s.id,
				createdAt: s.createdAt,
				lastActiveAt: s.lastActiveAt,
				expiresAt: s.expiresAt,
				deviceInfo: s.deviceInfo ? JSON.parse(s.deviceInfo) : null,
				ipAddress: s.ipAddress,
			})),
		};
	}),

	/**
	 * Return a per-session CSRF token for the authenticated web session.
	 * GET /api/v1/auth/csrfToken
	 *
	 * The token is HMAC-SHA256(sessionToken, AUTH_SECRET) — bound to the
	 * current session and unguessable without the server secret. The browser
	 * client caches it and sends it as x-csrf-token on every mutating request.
	 */
	csrfToken: async (ctx: ApiContext) => {
		if (ctx.isDemoMode) {
			return { csrfToken: null };
		}

		try {
			const csrfToken = await computeCsrfToken(ctx.req.headers.cookie ?? "");
			return { csrfToken };
		} catch (_err) {
			throw createApiError("Not authenticated", 401);
		}
	},
};
