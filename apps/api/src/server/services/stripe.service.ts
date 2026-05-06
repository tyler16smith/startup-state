import Stripe from "stripe";
import type { PrismaClient } from "../../../generated/prisma";
import { createApiError } from "../api-context";
import { type CheckoutPlanKey, getStripePriceIdForPlan } from "./stripe.mapper";

type DbClient = PrismaClient;

let stripeClient: Stripe | null = null;

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw createApiError(`${name} is not configured`, 500);
	}
	return value;
}

export function getStripeClient(): Stripe {
	if (stripeClient) return stripeClient;

	stripeClient = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));
	return stripeClient;
}

export function getWebOrigin(): string {
	return (
		process.env.WEB_ORIGIN ??
		process.env.NEXT_PUBLIC_WEB_URL ??
		process.env.APP_BASE_URL ??
		"http://localhost:3000"
	).replace(/\/$/, "");
}

export async function getOrCreateStripeCustomer(
	db: DbClient,
	userId: string,
): Promise<string> {
	const user = await db.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			email: true,
			name: true,
			subscriptionProviderCustomerId: true,
		},
	});

	if (!user) throw createApiError("Unauthorized", 401);
	if (user.subscriptionProviderCustomerId) {
		return user.subscriptionProviderCustomerId;
	}

	const stripe = getStripeClient();
	const customer = await stripe.customers.create({
		email: user.email ?? undefined,
		name: user.name ?? undefined,
		metadata: { userId: user.id },
	});

	await db.user.update({
		where: { id: user.id },
		data: { subscriptionProviderCustomerId: customer.id },
	});

	return customer.id;
}

export async function createEmbeddedCheckoutSession(params: {
	db: DbClient;
	userId: string;
	plan: CheckoutPlanKey;
}): Promise<{ clientSecret: string; sessionId: string }> {
	const customerId = await getOrCreateStripeCustomer(params.db, params.userId);
	const stripe = getStripeClient();
	const webOrigin = getWebOrigin();
	const session = await stripe.checkout.sessions.create({
		customer: customerId,
		line_items: [
			{
				price: getStripePriceIdForPlan(params.plan),
				quantity: 1,
			},
		],
		metadata: {
			userId: params.userId,
			planKey: params.plan,
		},
		mode: "subscription",
		return_url: `${webOrigin}/dashboard/settings?billing=return&session_id={CHECKOUT_SESSION_ID}`,
		subscription_data: {
			metadata: {
				userId: params.userId,
				planKey: params.plan,
			},
		},
		ui_mode: "embedded_page",
	});

	if (!session.client_secret) {
		throw createApiError("Stripe did not return a checkout client secret", 500);
	}

	return { clientSecret: session.client_secret, sessionId: session.id };
}

export async function retrieveCheckoutSession(
	sessionId: string,
): Promise<Stripe.Checkout.Session> {
	return getStripeClient().checkout.sessions.retrieve(sessionId);
}

export async function createBillingPortalSession(params: {
	customerId: string;
}): Promise<{ url: string }> {
	const stripe = getStripeClient();
	const webOrigin = getWebOrigin();
	const configuration = process.env.STRIPE_PORTAL_CONFIGURATION_ID || undefined;
	const session = await stripe.billingPortal.sessions.create({
		configuration,
		customer: params.customerId,
		return_url: `${webOrigin}/dashboard/settings?billing=portal-return`,
	});

	return { url: session.url };
}

export async function retrieveStripeSubscription(
	subscriptionId: string,
): Promise<Stripe.Subscription> {
	return getStripeClient().subscriptions.retrieve(subscriptionId);
}
