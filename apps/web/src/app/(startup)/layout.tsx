import { StartupSidebar } from "~/components/startup/startup-sidebar";

export default function StartupLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex h-screen bg-gray-50 text-slate-950">
			<StartupSidebar />
			<div className="flex flex-1 flex-col overflow-auto">{children}</div>
		</div>
	);
}
