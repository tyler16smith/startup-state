import { auth } from "~/server/auth/edge";

export default auth((req) => {
	const { nextUrl } = req;

	const isLoggedIn = !!req.auth;
	const requiresTwoFactor = req.auth?.requiresTwoFactor ?? false;

	const isAuthPage = nextUrl.pathname.startsWith("/auth");
	const isApiRoute = nextUrl.pathname.startsWith("/api");
	const is2FARoute = nextUrl.pathname === "/auth/verify-2fa";
	const isAdminRoute = nextUrl.pathname.startsWith("/admin");
	const isStartupPublicRoute =
		nextUrl.pathname === "/" ||
		nextUrl.pathname.startsWith("/explore") ||
		nextUrl.pathname.startsWith("/founder") ||
		nextUrl.pathname.startsWith("/investor") ||
		nextUrl.pathname.startsWith("/resources") ||
		nextUrl.pathname.startsWith("/map") ||
		nextUrl.pathname.startsWith("/companies");
	const isPublic = isAuthPage || isApiRoute || isStartupPublicRoute;

	if (isLoggedIn && isAdminRoute && req.auth?.user?.role !== "ADMIN") {
		return Response.redirect(new URL("/", nextUrl));
	}

	if (!isLoggedIn && !isPublic) {
		const url = new URL("/auth/signin", nextUrl);
		url.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
		return Response.redirect(url);
	}

	// Redirect authenticated users away from auth pages, but not the 2FA page
	if (isLoggedIn && isAuthPage && !is2FARoute) {
		return Response.redirect(new URL("/plan", nextUrl));
	}

	// Redirect to 2FA verification if pending
	if (isLoggedIn && requiresTwoFactor && !is2FARoute && !isApiRoute) {
		const url = nextUrl.clone();
		url.pathname = "/auth/verify-2fa";
		url.searchParams.set("callbackUrl", nextUrl.pathname);
		return Response.redirect(url);
	}
});

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.ico$).*)",
	],
};
