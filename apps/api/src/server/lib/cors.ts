import type { NextApiRequest, NextApiResponse } from "next";

const PRODUCTION_WEB_ORIGINS = ["https://utah-hackathon-web.vercel.app"];

const LOCAL_WEB_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function normalizeOrigin(origin: string): string {
	return origin.trim().replace(/\/$/, "");
}

function splitOrigins(value: string | undefined): string[] {
	if (!value) return [];
	return value.split(",").map(normalizeOrigin).filter(Boolean);
}

function withLocalhostVariant(origin: string): string[] {
	if (process.env.NODE_ENV === "production") return [origin];
	if (origin.includes("localhost")) {
		return [origin, origin.replace("localhost", "127.0.0.1")];
	}
	if (origin.includes("127.0.0.1")) {
		return [origin, origin.replace("127.0.0.1", "localhost")];
	}
	return [origin];
}

export function getAllowedOrigins(): string[] {
	const configuredOrigins = [
		...splitOrigins(process.env.CORS_ORIGINS),
		...splitOrigins(process.env.WEB_ORIGIN),
		...splitOrigins(process.env.NEXT_PUBLIC_WEB_URL),
	];

	return Array.from(
		new Set(
			[
				...PRODUCTION_WEB_ORIGINS,
				...LOCAL_WEB_ORIGINS,
				...configuredOrigins,
			].flatMap(withLocalhostVariant),
		),
	);
}

export function applyCorsHeaders(
	req: NextApiRequest,
	res: NextApiResponse,
	allowedMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS",
) {
	const origin = req.headers.origin;
	const allowedOrigins = getAllowedOrigins();
	const isAllowedOrigin = Boolean(origin && allowedOrigins.includes(origin));

	if (origin && isAllowedOrigin) {
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Vary", "Origin");
		res.setHeader("Access-Control-Allow-Credentials", "true");
		res.setHeader("Access-Control-Allow-Methods", allowedMethods);
		res.setHeader(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Active-App-Context, X-Demo-Overlay-Session-Key",
		);
	}

	return {
		origin,
		allowedOrigins,
		isAllowedOrigin,
	};
}

export function enforceOrigin(
	req: NextApiRequest,
	allowedOrigins: string[],
): void {
	const origin = req.headers.origin;

	if (!origin || !allowedOrigins.includes(origin)) {
		throw new Error("Origin not allowed");
	}
}
