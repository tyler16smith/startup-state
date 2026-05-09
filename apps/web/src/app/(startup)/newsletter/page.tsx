import { NewsletterSignupForm } from "~/components/startup/newsletter/newsletter-signup-form";

export default function NewsletterPage() {
	return (
		<main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
			<div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
				<div>
					<p className="font-medium text-emerald-700 text-sm">Newsletter</p>
					<h1 className="mt-2 font-semibold text-4xl tracking-normal">
						Stay in the loop
					</h1>
					<p className="mt-3 max-w-3xl text-muted-foreground">
						Get curated updates from Startup State based on what you care about,
						whether you are building, investing, hiring, fundraising, or
						exploring the startup ecosystem.
					</p>
				</div>
			</div>
			<NewsletterSignupForm />
		</main>
	);
}
