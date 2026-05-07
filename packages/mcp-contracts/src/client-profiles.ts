import { type McpToolName, mcpToolNames } from "./tools";

export const mcpClientProfiles = [
	"chatgpt",
	"openai-api",
	"claude",
	"gemini",
	"consumer",
	"cursor",
	"openclaw",
	"claude-desktop",
	"codex",
	"local-dev",
] as const;

export type McpClientProfile = (typeof mcpClientProfiles)[number];

export const publicClientProfiles = [
	"chatgpt",
	"openai-api",
	"claude",
	"gemini",
	"consumer",
	"claude-desktop",
	"codex",
] as const satisfies readonly McpClientProfile[];

export const defaultClientProfile: McpClientProfile = "local-dev";

export const profileToolAllowlist: Record<
	McpClientProfile,
	readonly McpToolName[]
> = Object.fromEntries(
	mcpClientProfiles.map((profile) => [profile, mcpToolNames]),
) as unknown as Record<McpClientProfile, readonly McpToolName[]>;

export function isMcpClientProfile(
	profile: string,
): profile is McpClientProfile {
	return (mcpClientProfiles as readonly string[]).includes(profile);
}
