"use client";

import {
	EmbeddedCheckout,
	EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey
	? loadStripe(stripePublishableKey)
	: null;

export function EmbeddedCheckoutPanel({
	clientSecret,
	onComplete,
}: {
	clientSecret: string;
	onComplete?: () => void;
}) {
	if (!stripePublishableKey || !stripePromise) {
		return (
			<div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
				Stripe is not configured for this environment.
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded-md border bg-background">
			<EmbeddedCheckoutProvider
				options={{ clientSecret, onComplete }}
				stripe={stripePromise}
			>
				<EmbeddedCheckout />
			</EmbeddedCheckoutProvider>
		</div>
	);
}
