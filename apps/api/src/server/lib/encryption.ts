/**
 * AES-256-GCM encryption utility for sensitive data (tokens, 2FA secrets, etc.).
 * Server-side only — never import from client code.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { logger } from "~/lib/logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
	const raw = process.env.ENCRYPTION_KEY;
	if (!raw) {
		throw new Error(
			"ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
		);
	}
	const buf = Buffer.from(raw, "hex");
	if (buf.length !== 32) {
		throw new Error(
			"ENCRYPTION_KEY must be a 64-character hex string (32 bytes).",
		);
	}
	return buf;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-delimited string: iv:authTag:ciphertext (all hex encoded).
 */
export function encrypt(text: string): string {
	const key = getKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv, {
		authTagLength: AUTH_TAG_LENGTH,
	});

	const encrypted = Buffer.concat([
		cipher.update(text, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	return [
		iv.toString("hex"),
		authTag.toString("hex"),
		encrypted.toString("hex"),
	].join(":");
}

/**
 * Decrypts a payload produced by `encrypt`.
 * Throws on tampered ciphertext or wrong key.
 */
export function decrypt(payload: string): string {
	try {
		const key = getKey();
		const parts = payload.split(":");
		if (parts.length !== 3) {
			throw new Error("Invalid encrypted payload format.");
		}
		const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];

		const iv = Buffer.from(ivHex, "hex");
		const authTag = Buffer.from(authTagHex, "hex");
		const encrypted = Buffer.from(encryptedHex, "hex");

		const decipher = createDecipheriv(ALGORITHM, key, iv, {
			authTagLength: AUTH_TAG_LENGTH,
		});
		decipher.setAuthTag(authTag);

		const decrypted = Buffer.concat([
			decipher.update(encrypted),
			decipher.final(),
		]);
		return decrypted.toString("utf8");
	} catch (error) {
		logger.error("Decryption failed", {
			feature: "encryption",
			operation: "decrypt",
			errorMessage: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}
