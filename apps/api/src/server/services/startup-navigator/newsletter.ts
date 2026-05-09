import type {
	NewsletterAudience,
	PrismaClient,
} from "../../../../generated/prisma";
import { newsletterSubscriptionInputSchema } from "./schemas";

type Db = PrismaClient;

function cleanOptional(value: string | null | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

export async function subscribeToNewsletter(
	db: Db,
	userId: string | null,
	input: unknown,
) {
	const data = newsletterSubscriptionInputSchema.parse(input);
	const audiences: NewsletterAudience[] = data.audiences;

	return db.newsletterSubscription.upsert({
		where: { email: data.email },
		create: {
			email: data.email,
			name: cleanOptional(data.name),
			audiences,
			interests: data.interests,
			stage: cleanOptional(data.stage),
			intent: cleanOptional(data.intent),
			details: cleanOptional(data.details),
			source: data.source,
			status: "SUBSCRIBED",
			...(userId ? { userId } : {}),
		},
		update: {
			name: cleanOptional(data.name),
			audiences,
			interests: data.interests,
			stage: cleanOptional(data.stage),
			intent: cleanOptional(data.intent),
			details: cleanOptional(data.details),
			source: data.source,
			status: "SUBSCRIBED",
			...(userId ? { userId } : {}),
		},
	});
}
