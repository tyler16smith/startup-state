import crypto from "node:crypto";

const TOKEN_BYTES = 32;

export function generateRawClaimVerificationToken(): string {
	return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashClaimVerificationToken(rawToken: string): string {
	return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function generateClaimVerificationTokenPair(): {
	rawToken: string;
	tokenHash: string;
} {
	const rawToken = generateRawClaimVerificationToken();
	return {
		rawToken,
		tokenHash: hashClaimVerificationToken(rawToken),
	};
}
