import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { PostHogProvider } from "~/components/providers/posthog-provider";
import { QueryProvider } from "~/components/providers/query-provider";
import { Toaster } from "~/components/ui/sonner";

export const metadata: Metadata = {
	title: "App",
	description:
		"Your financial intelligence platform to track and forecast your finances.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html className={`${geist.variable}`} lang="en">
			<body>
				<SessionProvider>
					<PostHogProvider>
						<QueryProvider>
							{children}
							<Toaster />
						</QueryProvider>
					</PostHogProvider>
				</SessionProvider>
			</body>
		</html>
	);
}
