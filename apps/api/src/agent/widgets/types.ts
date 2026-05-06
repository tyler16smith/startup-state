import type { FinWidgetActionType } from "./actions";

export type FinWidgetType = "insight_card";
export type FinWidgetSource = "app" | "example";
export type FinWidgetInteractionLevel = "display_only" | "server_action";

export type FinWidgetBase = {
	id: string;
	type: FinWidgetType;
	widgetSchemaVersion: string;
	title: string;
	description?: string;
	source: FinWidgetSource;
	generatedAt: string;
	interactionLevel: FinWidgetInteractionLevel;
};

export type InsightCardWidget = FinWidgetBase & {
	type: "insight_card";
	summary: string;
	items?: Array<{
		label: string;
		value: string;
		tone?: "default" | "positive" | "negative" | "warning";
	}>;
};

export type FinInteractiveWidget = InsightCardWidget & {
	interactionLevel: "server_action";
	actions: Array<{
		id: string;
		label: string;
		type: FinWidgetActionType;
		style?: "primary" | "secondary";
	}>;
};

export type ConfirmationCardWidget = FinInteractiveWidget;
export type FinWidget = InsightCardWidget | FinInteractiveWidget;
