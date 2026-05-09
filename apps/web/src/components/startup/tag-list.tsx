import { Badge } from "~/components/ui/badge";

export function TagList({
	items,
	limit = 5,
}: {
	items: string[];
	limit?: number;
}) {
	const visible = items.filter(Boolean).slice(0, limit);
	const remaining = items.filter(Boolean).length - visible.length;
	if (!visible.length) return null;
	return (
		<div className="flex min-w-0 flex-wrap gap-1.5">
			{visible.map((item) => (
				<Badge
					className="max-w-full whitespace-normal break-words rounded-md text-left"
					key={item}
					variant="secondary"
				>
					{item.replace(/_/g, " ")}
				</Badge>
			))}
			{remaining > 0 && (
				<Badge className="max-w-full rounded-md" variant="outline">
					+{remaining} more
				</Badge>
			)}
		</div>
	);
}
