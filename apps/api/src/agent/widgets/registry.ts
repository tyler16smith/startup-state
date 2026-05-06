import type { z } from "zod";
import { finWidgetSchema } from "./schemas";
import type { FinWidgetType } from "./types";

type WidgetRegistryEntry = {
	schema: z.ZodTypeAny;
	clientComponent: string;
};

export const finWidgetRegistry = {
	insight_card: {
		schema: finWidgetSchema,
		clientComponent: "InsightCardWidget",
	},
} satisfies Record<FinWidgetType, WidgetRegistryEntry>;

export function isRegisteredWidgetType(type: string): type is FinWidgetType {
	return type in finWidgetRegistry;
}
