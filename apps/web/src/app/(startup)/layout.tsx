import { StartupLayoutShell } from "~/components/startup/startup-layout-shell";

export default function StartupLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <StartupLayoutShell>{children}</StartupLayoutShell>;
}
