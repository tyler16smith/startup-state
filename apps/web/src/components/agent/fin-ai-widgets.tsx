"use client";

export type FinWidgetActionType = "noop";

export type FinWidget = {
	id: string;
	type: "insight_card";
	widgetSchemaVersion: string;
	title: string;
	description?: string;
	source: "app" | "example";
	generatedAt: string;
	interactionLevel: "display_only" | "server_action";
	summary: string;
	items?: Array<{
		label: string;
		value: string;
		tone?: "default" | "positive" | "negative" | "warning";
	}>;
};

export type WidgetActionSubmit = (input: {
	widgetId: string;
	actionType: FinWidgetActionType;
	values: Record<string, unknown>;
}) => void | Promise<void>;

function InsightCardWidget({ widget }: { widget: FinWidget }) {
	return (
		<div className="w-full rounded-md border bg-card p-3 text-card-foreground shadow-sm">
			<div className="mb-3 min-w-0">
				<h3 className="break-words font-medium text-sm">{widget.title}</h3>
				{widget.description ? (
					<p className="mt-1 break-words text-muted-foreground text-xs leading-5">
						{widget.description}
					</p>
				) : null}
			</div>
			<p className="break-words text-sm leading-6">{widget.summary}</p>
			{widget.items?.length ? (
				<div className="mt-3 grid gap-2">
					{widget.items.map((item) => (
						<div
							className="flex items-center justify-between gap-3 rounded-md bg-muted px-2 py-1.5"
							key={`${item.label}-${item.value}`}
						>
							<span className="min-w-0 break-words text-muted-foreground text-xs">
								{item.label}
							</span>
							<span className="shrink-0 font-medium text-xs">{item.value}</span>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}

export function FinWidgetRenderer({ widget }: { widget: FinWidget }) {
	if (widget.type !== "insight_card") return null;
	return <InsightCardWidget widget={widget} />;
}

export function ActionResultBlock({ summary }: { summary: string }) {
	return (
		<div className="rounded-md border bg-card px-3 py-2 text-card-foreground text-sm">
			{summary}
		</div>
	);
}
