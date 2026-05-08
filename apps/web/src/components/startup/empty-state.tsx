import type { LucideIcon } from "lucide-react";

export function EmptyState({
	icon: Icon,
	title,
	description,
}: {
	icon: LucideIcon;
	title: string;
	description: string;
}) {
	return (
		<div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed bg-white px-6 py-12 text-center">
			<div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
				<Icon aria-hidden="true" className="size-5" />
			</div>
			<h2 className="font-semibold text-xl">{title}</h2>
			<p className="mt-2 max-w-md text-muted-foreground text-sm">
				{description}
			</p>
		</div>
	);
}
