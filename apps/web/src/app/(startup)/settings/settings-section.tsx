import type { ReactNode } from "react";

interface SettingsSectionProps {
	title: string;
	children: ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
	return (
		<div className="space-y-3">
			<h2 className="font-semibold text-base">{title}</h2>
			{children}
		</div>
	);
}
