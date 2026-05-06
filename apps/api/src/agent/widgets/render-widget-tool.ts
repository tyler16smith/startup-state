import type { z } from "zod";
import type { FinToolDefinition } from "../tools/types";
import { finWidgetSchema } from "./schemas";
import type { FinWidget } from "./types";

const renderWidgetInputSchema = finWidgetSchema;

type RenderWidgetInput = z.input<typeof renderWidgetInputSchema>;

export const renderWidgetTool: FinToolDefinition<
	RenderWidgetInput,
	{
		widget: FinWidget;
	}
> = {
	name: "render_widget",
	displayName: "Render widget",
	description: "Render a generic insight card widget.",
	enabled: false,
	capabilities: ["read:app"],
	safetyClass: "read_only_app_data",
	inputSchema: renderWidgetInputSchema,
	execute: async (input) => ({ widget: renderWidgetInputSchema.parse(input) }),
};
