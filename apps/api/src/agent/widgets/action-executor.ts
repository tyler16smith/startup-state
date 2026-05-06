import { z } from "zod";
import type { FinStreamEvent } from "../events";

export const widgetActionStreamInputSchema = z.object({
	conversationId: z.string().min(1),
	widgetId: z.string().min(1),
	actionType: z.string().min(1),
	values: z.record(z.unknown()),
	clientRequestId: z.string().min(1).max(200).optional(),
});

export type WidgetActionStreamInput = z.infer<
	typeof widgetActionStreamInputSchema
>;

export type ExecuteWidgetActionInput = WidgetActionStreamInput & {
	userId: string;
	householdId?: string;
	runId: string;
	stepId: string;
	abortSignal?: AbortSignal;
	emit?: (event: FinStreamEvent) => void | Promise<void>;
};

type ExecuteWidgetActionResult = {
	status: "completed" | "waiting_for_user";
	summary: string;
};

export async function executeWidgetAction(
	_input: ExecuteWidgetActionInput,
): Promise<ExecuteWidgetActionResult> {
	return {
		status: "completed",
		summary: "hello_world",
	};
}
