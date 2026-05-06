import { Axiom } from "@axiomhq/js";
import { getEnv } from "~/config/env";

type LogLevel = "info" | "warn" | "error";

type LogContext = {
	feature?: string;
	operation?: string;
	userId?: string;
	errorMessage?: string;
	errorCode?: string;
	stack?: string;
	[key: string]: unknown;
};

let axiomClient: Axiom | null = null;

function getAxiomClient(): Axiom | null {
	if (axiomClient) return axiomClient;
	const env = getEnv();
	if (!env.AXIOM_TOKEN || !env.AXIOM_DATASET) return null;
	axiomClient = new Axiom({ token: env.AXIOM_TOKEN });
	return axiomClient;
}

function formatMessage(
	level: LogLevel,
	message: string,
	context: LogContext,
): string {
	const contextString = Object.entries(context)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${JSON.stringify(value)}`)
		.join(" ");
	return `[${level.toUpperCase()}] ${message}${contextString ? ` | ${contextString}` : ""}`;
}

async function log(
	level: LogLevel,
	message: string,
	context: LogContext = {},
): Promise<void> {
	const env = getEnv();
	const logData = {
		level,
		message,
		timestamp: new Date().toISOString(),
		app: "fin-mcp",
		...context,
	};

	if (env.NODE_ENV === "development") {
		const formatted = formatMessage(level, message, context);
		if (level === "error") console.error(formatted);
		else if (level === "warn") console.warn(formatted);
		else console.log(formatted);
	}

	const client = getAxiomClient();
	if (client && env.AXIOM_DATASET) {
		client.ingest(env.AXIOM_DATASET, [logData]);
		if (level === "error") {
			await client.flush().catch(() => undefined);
		}
	}
}

export function normalizeError(error: unknown): {
	errorMessage: string;
	errorCode?: string;
	stack?: string;
} {
	if (error instanceof Error) {
		return {
			errorMessage: error.message,
			errorCode:
				(error as { errorCode?: string }).errorCode ??
				(error as { code?: string }).code,
			stack: getEnv().NODE_ENV === "development" ? error.stack : undefined,
		};
	}
	if (typeof error === "string") return { errorMessage: error };
	return { errorMessage: "Unknown error" };
}

export const logger = {
	info: (message: string, context: LogContext = {}) =>
		log("info", message, context),
	warn: (message: string, context: LogContext = {}) =>
		log("warn", message, context),
	error: (message: string, context: LogContext = {}) =>
		log("error", message, context),
	logError: (message: string, error: unknown, context: LogContext = {}) =>
		log("error", message, { ...context, ...normalizeError(error) }),
};
