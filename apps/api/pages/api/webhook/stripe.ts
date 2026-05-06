import type { IncomingMessage } from "node:http";
import type { NextApiRequest, NextApiResponse } from "next";
import type Stripe from "stripe";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { getStripeClient } from "~/server/services/stripe.service";
import { processStripeWebhookEvent } from "~/server/services/stripe.webhook";

export const config = {
	api: { bodyParser: false },
};

function getRawBody(req: IncomingMessage): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});
}

function getHeaderValue(header: string | string[] | undefined) {
	return Array.isArray(header) ? header[0] : header;
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const signature = getHeaderValue(req.headers["stripe-signature"]);
	if (!signature) {
		return res.status(400).json({ error: "Missing Stripe signature" });
	}

	const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
	if (!webhookSecret) {
		await logger.error("STRIPE_WEBHOOK_SECRET is not configured", {
			feature: "billing",
			operation: "webhook.verify",
		});
		return res.status(500).json({ error: "Stripe webhook is not configured" });
	}

	const rawBody = await getRawBody(req);
	let event: Stripe.Event;

	try {
		event = getStripeClient().webhooks.constructEvent(
			rawBody,
			signature,
			webhookSecret,
		);
	} catch (error) {
		await logger.warn("Stripe webhook signature verification failed", {
			feature: "billing",
			operation: "webhook.verify",
			errorMessage: error instanceof Error ? error.message : "Unknown error",
		});
		return res.status(400).json({ error: "Invalid Stripe signature" });
	}

	try {
		await processStripeWebhookEvent(db, event);
		return res.status(200).json({ received: true });
	} catch (error) {
		await logger.logError("Stripe webhook processing failed", error, {
			feature: "billing",
			operation: "webhook.process",
			stripeEventId: event.id,
			stripeEventType: event.type,
		});
		return res.status(500).json({ error: "Webhook processing failed" });
	}
}
