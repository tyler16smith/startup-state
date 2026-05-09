import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { USER_ROLE } from "~/lib/user-role";
import { getAuthCookieDomain } from "./cookie-domain";

// Startup check for AUTH_SECRET
if (typeof process !== "undefined" && !process.env.AUTH_SECRET) {
	console.error("[AUTH] AUTH_SECRET is not set!");
}

// Edge-safe config for middleware only.
// Used exclusively in middleware (Edge Runtime).
export const edgeAuthConfig = {
	providers: [Google],
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
				domain: getAuthCookieDomain(),
			},
		},
	},
	callbacks: {
		jwt({ token, user, trigger, session }) {
			if (user) {
				token.id = user.id;
				token.requiresTwoFactor = user.twoFactorEnabled ?? false;
			}
			if (trigger === "update") {
				const s = session as { twoFactorVerified?: boolean } | null;
				if (s?.twoFactorVerified) {
					token.requiresTwoFactor = false;
				}
			}
			return token;
		},
		session({ session, token }) {
			if (token.id) {
				session.user.id = token.id as string;
			}
			session.user.role = token.role ?? USER_ROLE.USER;
			if (token.requiresTwoFactor !== undefined) {
				session.requiresTwoFactor = token.requiresTwoFactor as boolean;
			}
			return session;
		},
	},
	pages: {
		signIn: "/auth/signin",
	},
} satisfies NextAuthConfig;
