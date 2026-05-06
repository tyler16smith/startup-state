import { mcpToolContracts } from "@app/mcp-contracts";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

export const getProfileTool: McpToolImplementation = {
	contract: mcpToolContracts["mcp.get_profile"],
	async execute(_input, context) {
		const [user, settings] = await Promise.all([
			context.db.user.findUnique({
				where: { id: context.userId },
				select: { id: true, name: true, email: true },
			}),
			context.db.userSettings.findUnique({
				where: { userId: context.userId },
				select: { hasCompletedInitialOnboarding: true },
			}),
		]);

		return schemaEnvelope("profile.get", {
			profile: {
				id: user?.id ?? context.userId,
				name: user?.name ?? null,
				email: user?.email ?? null,
				hasCompletedInitialOnboarding:
					settings?.hasCompletedInitialOnboarding ?? false,
			},
		});
	},
};
