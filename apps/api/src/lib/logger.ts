import { Axiom } from "@axiomhq/js";

/**
 * Axiom Logger - Structured logging for the API app.
 *
 * Usage:
 *   import { logger } from '~/server/lib/logger';
 *   logger.error('Failed to load profile', { feature: 'account', userId, errorMessage: err.message });
 *   logger.warn('Rate limit approaching', { feature: 'mcp', operation: 'tool_call' });
 *   logger.info('Webhook received', { feature: 'billing', type: 'checkout.completed' });
 *
 * Important:
 *   - Never log PII, secrets, tokens, account numbers, or sensitive data
 *   - Use structured fields: feature, operation, userId, errorMessage, errorCode, stack
 *   - Prefer one high-quality log at the failure boundary
 */

type LogLevel = "info" | "warn" | "error";

interface LogContext {
	feature?: string;
	operation?: string;
	userId?: string;
	errorMessage?: string;
	errorCode?: string;
	stack?: string;
	[key: string]: unknown;
}

let axiomClient: Axiom | null = null;
let dataset: string | null = null;

function getAxiomClient(): Axiom | null {
	if (axiomClient) return axiomClient;

	const token = process.env.AXIOM_TOKEN;
	const ds = process.env.AXIOM_DATASET;

	if (!token || !ds) {
		if (process.env.NODE_ENV === "development") {
			console.warn("Axiom credentials not configured, logging to console only");
		}
		return null;
	}

	axiomClient = new Axiom({ token });
	dataset = ds;

	return axiomClient;
}

function formatMessage(
	level: LogLevel,
	message: string,
	context: LogContext,
): string {
	const contextStr = Object.entries(context)
		.filter(([_, v]) => v !== undefined)
		.map(([k, v]) => `${k}=${JSON.stringify(v)}`)
		.join(" ");
	return `[${level.toUpperCase()}] ${message}${contextStr ? ` | ${contextStr}` : ""}`;
}

async function log(
	level: LogLevel,
	message: string,
	context: LogContext = {},
): Promise<void> {
	const logData = {
		level,
		message,
		timestamp: new Date().toISOString(),
		app: "app-api",
		...context,
	};

	// Always log to console in development
	if (process.env.NODE_ENV === "development") {
		const formatted = formatMessage(level, message, context);
		switch (level) {
			case "error":
				console.error(formatted);
				break;
			case "warn":
				console.warn(formatted);
				break;
			default:
				console.log(formatted);
		}
	}

	// Send to Axiom in production
	const client = getAxiomClient();
	if (client && dataset) {
		client.ingest(dataset, [logData]);
		// Axiom batches and flushes automatically, but we can flush on errors
		if (level === "error") {
			await client.flush().catch(() => {
				// Silently ignore flush errors
			});
		}
	}
}

/**
 * Converts an unknown error to a safe, serializable object.
 * Never includes sensitive data.
 */
export function normalizeError(error: unknown): {
	errorMessage: string;
	errorCode?: string;
	stack?: string;
} {
	if (error instanceof Error) {
		return {
			errorMessage: error.message,
			errorCode: (error as { code?: string }).code,
			stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
		};
	}

	if (typeof error === "string") {
		return { errorMessage: error };
	}

	return { errorMessage: "Unknown error" };
}

export const logger = {
	/**
	 * Log informational messages for major lifecycle events.
	 * Use sparingly - avoid noisy logs.
	 */
	info: (message: string, context: LogContext = {}) =>
		log("info", message, context),

	/**
	 * Log warnings for recoverable issues.
	 */
	warn: (message: string, context: LogContext = {}) =>
		log("warn", message, context),

	/**
	 * Log errors for failed operations and thrown exceptions.
	 * Always log before re-throwing or returning error responses.
	 */
	error: (message: string, context: LogContext = {}) =>
		log("error", message, context),

	/**
	 * Helper to log an error with normalized error details.
	 */
	logError: (message: string, error: unknown, context: LogContext = {}) =>
		log("error", message, { ...context, ...normalizeError(error) }),
};
