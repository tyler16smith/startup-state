import type { DefaultSession, NextAuthConfig } from "next-auth";
// biome-ignore lint/correctness/noUnusedImports: Required for module augmentation to work
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { USER_ROLE, type UserRole } from "~/lib/user-role";

import {
	authorizeCredentials,
	getAuthUser,
	resolveGoogleUser,
} from "./api-auth";

// Startup check for AUTH_SECRET
if (!process.env.AUTH_SECRET) {
	console.error("[AUTH] AUTH_SECRET is not set!");
}

declare module "next-auth" {
	interface User {
		twoFactorEnabled?: boolean;
		role?: UserRole;
	}
	interface Session extends DefaultSession {
		user: {
			id: string;
			role: UserRole;
		} & DefaultSession["user"];
		requiresTwoFactor?: boolean;
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		id?: string;
		role?: UserRole;
		requiresTwoFactor?: boolean;
		roleRefreshedAt?: number;
	}
}

async function resolveGoogleAccount(idToken: unknown) {
	if (typeof idToken !== "string") return null;
	return resolveGoogleUser({ idToken });
}

export const authConfig = {
	providers: [
		Google,
		Credentials({
			name: "credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				const parsed = z
					.object({ email: z.string().email(), password: z.string().min(1) })
					.safeParse(credentials);

				if (!parsed.success) return null;

				const user = await authorizeCredentials({
					email: parsed.data.email,
					password: parsed.data.password,
				});

				if (!user) return null;

				return {
					id: user.id,
					email: user.email,
					name: user.name,
					image: user.image,
					role: user.role,
					twoFactorEnabled: user.twoFactorEnabled,
				};
			},
		}),
	],
	session: { strategy: "jwt" },
	cookies: {
		sessionToken: {
			name:
				process.env.NODE_ENV === "production"
					? "__Secure-authjs.session-token"
					: "authjs.session-token",
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: process.env.NODE_ENV === "production",
				// Set AUTH_COOKIE_DOMAIN to share cookies across app/api subdomains.
				domain:
					process.env.NODE_ENV === "production"
						? process.env.AUTH_COOKIE_DOMAIN || undefined
						: undefined,
			},
		},
	},
	callbacks: {
		async signIn({ user, account }) {
			if (account?.provider !== "google") return true;

			const resolvedUser = await resolveGoogleAccount(account.id_token);
			if (!resolvedUser) return false;

			user.id = resolvedUser.id;
			user.email = resolvedUser.email;
			user.name = resolvedUser.name;
			user.image = resolvedUser.image;
			user.role = resolvedUser.role;
			user.twoFactorEnabled = resolvedUser.twoFactorEnabled;

			return true;
		},
		async jwt({ token, user, account, trigger, session }) {
			if (account?.provider === "google") {
				const resolvedUser = await resolveGoogleAccount(account.id_token);
				if (resolvedUser) {
					token.id = resolvedUser.id;
					token.sub = resolvedUser.id;
					token.email = resolvedUser.email;
					token.name = resolvedUser.name;
					token.picture = resolvedUser.image;
					token.role = resolvedUser.role;
					token.requiresTwoFactor = resolvedUser.twoFactorEnabled;
					return token;
				}
			}

			if (user) {
				token.id = user.id;
				token.sub = user.id;
				token.role = user.role;
				token.requiresTwoFactor = user.twoFactorEnabled ?? false;
				token.roleRefreshedAt = Date.now();
			} else if (token.id) {
				// Refresh role from DB every 5 minutes so DB changes propagate without re-login
				const FIVE_MINUTES = 5 * 60 * 1000;
				if (
					!token.roleRefreshedAt ||
					Date.now() - token.roleRefreshedAt > FIVE_MINUTES
				) {
					const freshUser = await getAuthUser({ userId: token.id });
					if (freshUser) {
						token.role = freshUser.role;
					}
					token.roleRefreshedAt = Date.now();
				}
			}
			if (trigger === "update") {
				const s = session as {
					twoFactorVerified?: boolean;
					name?: string;
				} | null;
				if (s?.twoFactorVerified) {
					token.requiresTwoFactor = false;
				}
				if (typeof s?.name === "string") {
					token.name = s.name;
				}
			}
			return token;
		},
		session({ session, token }) {
			if (token.id) {
				session.user.id = token.id;
			}
			session.user.role = token.role ?? USER_ROLE.USER;
			if (token.requiresTwoFactor !== undefined) {
				session.requiresTwoFactor = token.requiresTwoFactor as boolean;
			}
			return session;
		},
		redirect({ url, baseUrl }) {
			// Allow same-origin redirects
			if (url.startsWith(baseUrl)) {
				return url;
			}
			// Allow relative URLs
			if (url.startsWith("/")) {
				return `${baseUrl}${url}`;
			}
			// Default to the latest saved navigator plan.
			return `${baseUrl}/plan`;
		},
	},
	pages: {
		signIn: "/auth/signin",
	},
} satisfies NextAuthConfig;
