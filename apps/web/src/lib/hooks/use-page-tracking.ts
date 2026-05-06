"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { isPostHogInitialized, posthog } from "~/lib/posthog";

/**
 * Tracks page views on route changes.
 * Should be called in a layout that wraps all tracked pages.
 *
 * Events include:
 * - `path`: the current pathname
 * - `userId`: if the user is logged in
 * - `demoUser: true`: if the user is not logged in
 */
export function usePageTracking() {
	const pathname = usePathname();
	const { data: session, status } = useSession();

	// Identify user when session changes
	useEffect(() => {
		if (!isPostHogInitialized()) return;

		const userId = session?.user?.id;
		if (userId) {
			posthog.identify(userId, {
				email: session.user.email ?? undefined,
				name: session.user.name ?? undefined,
			});
		}
	}, [session]);

	// Track page views
	useEffect(() => {
		if (!isPostHogInitialized()) return;
		if (!pathname) return;
		// Wait for session to load before tracking
		if (status === "loading") return;

		const userId = session?.user?.id;

		posthog.capture("$pageview", {
			path: pathname,
			...(userId ? { userId } : { demoUser: true }),
		});
	}, [pathname, session, status]);
}
