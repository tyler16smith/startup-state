import type Stripe from "stripe";
import { logger } from "~/lib/logger";
import type { PrismaClient } from "../../../generated/prisma";
import {
	getPrimarySubscriptionItem,
	mapStripeInterval,
	mapStripePriceIdToPlan,
	mapStripeStatusToAppStatus,
	unixToDate,
} from "./stripe.mapper";
import { retrieveStripeSubscription } from "./stripe.service";

type DbClient = PrismaClient;

type SubscriptionPeriodFields = {
	current_period_start?: number | null;
	current_period_end?: number | null;
	cancel_at_period_end?: boolean | null;
	canceled_at?: number | null;
};

function getStringId(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (typeof value !== "object" || value === null) return null;
	if ("id" in value && typeof value.id === "string") return value.id;
	return null;
}

function getRecordValue(record: unknown, key: string): unknown {
	if (typeof record !== "object" || record === null) return undefined;
	if (!(key in record)) return undefined;
	return record[key as keyof typeof record];
}

function getSubscriptionPeriodFields(
	subscription: Stripe.Subscription,
	item: Stripe.SubscriptionItem | null,
): SubscriptionPeriodFields {
	const subscriptionRecord =
		subscription as unknown as SubscriptionPeriodFields;
	const itemRecord = item as unknown as SubscriptionPeriodFields | null;

	return {
		cancel_at_period_end: subscriptionRecord.cancel_at_period_end,
		canceled_at: subscriptionRecord.canceled_at,
		current_period_end:
			subscriptionRecord.current_period_end ?? itemRecord?.current_period_end,
		current_period_start:
			subscriptionRecord.current_period_start ??
			itemRecord?.current_period_start,
	};
}

async function findUserForSubscription(params: {
	db: DbClient;
	customerId: string | null;
	subscriptionId: string;
	metadataUserId?: string | null;
}) {
	return params.db.user.findFirst({
		where: {
			OR: [
				{ subscriptionProviderSubscriptionId: params.subscriptionId },
				...(params.customerId
					? [{ subscriptionProviderCustomerId: params.customerId }]
					: []),
				...(params.metadataUserId ? [{ id: params.metadataUserId }] : []),
			],
		},
		select: { id: true, subscriptionLastWebhookEventId: true },
	});
}

export async function syncStripeSubscriptionToUser(params: {
	db: DbClient;
	subscription: Stripe.Subscription;
	eventId: string;
	fallbackUserId?: string | null;
	forceCanceled?: boolean;
}) {
	const { db, eventId, subscription } = params;
	const item = getPrimarySubscriptionItem(subscription);
	const price = item?.price ?? null;
	const priceId = price?.id ?? null;
	const customerId = getStringId(subscription.customer);
	const metadataUserId = subscription.metadata?.userId ?? params.fallbackUserId;
	const user = await findUserForSubscription({
		customerId,
		db,
		metadataUserId,
		subscriptionId: subscription.id,
	});

	if (!user) {
		await logger.warn("Stripe subscription webhook had no matching user", {
			feature: "billing",
			operation: "webhook.subscriptionSync",
			stripeCustomerId: customerId,
			stripeSubscriptionId: subscription.id,
		});
		return { synced: false, reason: "user_not_found" as const };
	}

	if (user.subscriptionLastWebhookEventId === eventId) {
		return { synced: false, reason: "duplicate_event" as const };
	}

	const period = getSubscriptionPeriodFields(subscription, item);
	const mappedStatus = params.forceCanceled
		? "CANCELED"
		: mapStripeStatusToAppStatus(subscription.status);
	const subscriptionStatus = mappedStatus;
	const subscriptionPlan =
		subscriptionStatus === "CANCELED" || !priceId
			? "NONE"
			: mapStripePriceIdToPlan(priceId);

	await db.user.update({
		where: { id: user.id },
		data: {
			subscriptionCancelAtPeriodEnd: Boolean(period.cancel_at_period_end),
			subscriptionCanceledAt: unixToDate(period.canceled_at),
			subscriptionCurrentPeriodEnd: unixToDate(period.current_period_end),
			subscriptionCurrentPeriodStart: unixToDate(period.current_period_start),
			subscriptionInterval:
				mapStripeInterval(price?.recurring?.interval) ?? null,
			subscriptionLastWebhookEventId: eventId,
			subscriptionPlan,
			subscriptionProviderCustomerId: customerId,
			subscriptionProviderPriceId: priceId,
			subscriptionProviderSubscriptionId: subscription.id,
			subscriptionStatus,
		},
	});

	await logger.info("Stripe subscription synced", {
		feature: "billing",
		operation: "webhook.subscriptionSync",
		stripeEventId: eventId,
		stripeSubscriptionId: subscription.id,
		subscriptionPlan,
		subscriptionStatus,
		userId: user.id,
	});

	return { synced: true, reason: null };
}

export async function syncStripeCheckoutSessionToUser(params: {
	db: DbClient;
	session: Stripe.Checkout.Session;
	eventId: string;
	fallbackUserId?: string | null;
}) {
	const { db, eventId, session } = params;
	if (session.mode !== "subscription") {
		return { synced: false, reason: "not_subscription" as const };
	}

	const subscriptionId = getStringId(session.subscription);
	if (!subscriptionId) {
		await logger.warn("Stripe checkout session missing subscription", {
			feature: "billing",
			operation: "checkoutSession.sync",
			stripeCheckoutSessionId: session.id,
		});
		return { synced: false, reason: "subscription_missing" as const };
	}

	const subscription = await retrieveStripeSubscription(subscriptionId);
	return syncStripeSubscriptionToUser({
		db,
		eventId,
		fallbackUserId: session.metadata?.userId ?? params.fallbackUserId ?? null,
		subscription,
	});
}

async function handleCheckoutSessionCompleted(
	db: DbClient,
	event: Stripe.Event,
) {
	const session = event.data.object as Stripe.Checkout.Session;
	await syncStripeCheckoutSessionToUser({
		db,
		eventId: event.id,
		fallbackUserId: session.metadata?.userId ?? null,
		session,
	});
}

async function handleSubscriptionEvent(
	db: DbClient,
	event: Stripe.Event,
	forceCanceled = false,
) {
	const subscription = event.data.object as Stripe.Subscription;
	await syncStripeSubscriptionToUser({
		db,
		eventId: event.id,
		forceCanceled,
		subscription,
	});
}

async function handleInvoiceEvent(
	db: DbClient,
	event: Stripe.Event,
	statusOverride?: "PAST_DUE",
) {
	const invoice = event.data.object as Stripe.Invoice;
	const subscriptionId = getStringId(getRecordValue(invoice, "subscription"));
	const customerId = getStringId(invoice.customer);

	if (subscriptionId) {
		const subscription = await retrieveStripeSubscription(subscriptionId);
		await syncStripeSubscriptionToUser({
			db,
			eventId: event.id,
			subscription,
		});
		return;
	}

	if (statusOverride && customerId) {
		const user = await db.user.findUnique({
			where: { subscriptionProviderCustomerId: customerId },
			select: { id: true, subscriptionLastWebhookEventId: true },
		});

		if (!user || user.subscriptionLastWebhookEventId === event.id) return;

		await db.user.update({
			where: { id: user.id },
			data: {
				subscriptionLastWebhookEventId: event.id,
				subscriptionStatus: statusOverride,
			},
		});
	}
}

export async function processStripeWebhookEvent(
	db: DbClient,
	event: Stripe.Event,
) {
	switch (event.type) {
		case "checkout.session.completed":
			await handleCheckoutSessionCompleted(db, event);
			break;
		case "customer.subscription.created":
		case "customer.subscription.updated":
			await handleSubscriptionEvent(db, event);
			break;
		case "customer.subscription.deleted":
			await handleSubscriptionEvent(db, event, true);
			break;
		case "invoice.paid":
			await handleInvoiceEvent(db, event);
			break;
		case "invoice.payment_failed":
			await handleInvoiceEvent(db, event, "PAST_DUE");
			break;
		default:
			await logger.info("Ignored Stripe webhook event", {
				feature: "billing",
				operation: "webhook.ignore",
				stripeEventType: event.type,
			});
	}
}
