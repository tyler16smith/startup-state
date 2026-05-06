import { z } from "zod";

const envSchema = z
	.object({
		DATABASE_URL: z.string().min(1),
		MCP_BASE_URL: z.string().url().default("http://localhost:3010"),
		WEB_APP_URL: z.string().url().default("http://localhost:3000"),
		MCP_PORT: z.coerce.number().int().min(1).max(65535).default(3010),
		MCP_TOKEN_PEPPER: z.string().min(32).optional(),
		MCP_OAUTH_ISSUER: z.string().url().optional(),
		MCP_OAUTH_CHATGPT_REDIRECT_HOSTS: z.string().optional(),
		MCP_OAUTH_CLAUDE_REDIRECT_HOSTS: z.string().optional(),
		MCP_OAUTH_GEMINI_REDIRECT_HOSTS: z.string().optional(),
		MCP_OAUTH_CONSUMER_REDIRECT_HOSTS: z.string().optional(),
		UPSTASH_REDIS_REST_URL: z.string().url().optional(),
		UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
		AXIOM_TOKEN: z.string().optional(),
		AXIOM_DATASET: z.string().optional(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	})
	.superRefine((env, context) => {
		if (env.NODE_ENV === "production" && !env.MCP_TOKEN_PEPPER) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["MCP_TOKEN_PEPPER"],
				message: "MCP_TOKEN_PEPPER is required in production",
			});
		}
	});

export type McpEnv = z.infer<typeof envSchema>;

let cachedEnv: McpEnv | null = null;

export function getEnv(): McpEnv {
	if (cachedEnv) return cachedEnv;

	const parsed = envSchema.safeParse(process.env);
	if (!parsed.success) {
		const message = parsed.error.issues
			.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
			.join("; ");
		throw new Error(`Invalid MCP environment: ${message}`);
	}

	cachedEnv = parsed.data;
	return cachedEnv;
}

export function getTokenPepper(): string {
	const pepper = getEnv().MCP_TOKEN_PEPPER;
	if (!pepper) {
		throw new Error("MCP_TOKEN_PEPPER is required for token hashing");
	}
	return pepper;
}
