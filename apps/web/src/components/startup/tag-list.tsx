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
		<div className="flex flex-wrap gap-1.5">
			{visible.map((item) => (
				<Badge className="rounded-md" key={item} variant="secondary">
					{item.replace(/_/g, " ")}
				</Badge>
			))}
			{remaining > 0 && (
				<Badge className="rounded-md" variant="outline">
					+{remaining} more
				</Badge>
			)}
		</div>
	);
}
