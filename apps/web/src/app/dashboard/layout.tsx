import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FinAiPanelProvider } from "~/components/agent/fin-ai-context";
import { FinAiWorkspace } from "~/components/agent/fin-ai-workspace";
import { DemoAnonymousCta } from "~/components/demo/demo-anonymous-cta";
import { DemoBanner } from "~/components/demo/demo-banner";
import { DemoFirstEntryModal } from "~/components/demo/demo-first-entry-modal";
import { DashboardProviders } from "~/components/layout/dashboard-providers";
import { MobileSidebarSheet } from "~/components/layout/mobile-sidebar-sheet";
import { OnboardingRedirectGuard } from "~/components/layout/onboarding-redirect-guard";
import { Sidebar } from "~/components/layout/sidebar";
import { PageTracker } from "~/components/providers/page-tracker";
import { auth } from "~/server/auth";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const cookieStore = await cookies();
	const isDemoMode = cookieStore.get("activeAppContext")?.value === "demo";

	const session = await auth();
	const sessionUser = session?.user;
	if (!sessionUser && !isDemoMode) redirect("/auth/signin");

	return (
		<DashboardProviders>
			<OnboardingRedirectGuard />
			<PageTracker />
			<DemoBanner />
			<FinAiPanelProvider>
				<div className="flex h-screen flex-col overflow-hidden bg-background">
					<DemoAnonymousCta />
					<div className="flex min-h-0 flex-1">
						<div className="hidden md:flex">
							<Sidebar />
						</div>
						<FinAiWorkspace>
							{/* Mobile-only header */}
							<MobileSidebarSheet />
							<main className="flex-1 overflow-y-auto p-4 md:p-6">
								{children}
							</main>
						</FinAiWorkspace>
					</div>
				</div>
				<DemoFirstEntryModal />
			</FinAiPanelProvider>
		</DashboardProviders>
	);
}
