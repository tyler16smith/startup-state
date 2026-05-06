import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
const PREFIX_LENGTH = 12;

export function getMcpTokenPepper(): string {
	const pepper = process.env.MCP_TOKEN_PEPPER ?? process.env.DATABASE_URL;
	if (!pepper) throw new Error("MCP token pepper is not configured");
	return pepper;
}

export function hashMcpToken(token: string): string {
	return createHash("sha256")
		.update(token)
		.update(getMcpTokenPepper())
		.digest("hex");
}

export function createOpaqueMcpToken(prefix: "fin_dev" | "fin_oauth") {
	const secret = randomBytes(TOKEN_BYTES).toString("base64url");
	const token = `${prefix}_${secret}`;
	return {
		token,
		tokenPrefix: token.slice(0, PREFIX_LENGTH),
		tokenHash: hashMcpToken(token),
	};
}

export function createOAuthAuthorizationCodeValue(): string {
	return randomBytes(32).toString("base64url");
}

export function hashOAuthAuthorizationCode(code: string): string {
	return createHash("sha256").update(code).digest("hex");
}
