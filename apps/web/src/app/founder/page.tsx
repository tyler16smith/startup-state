import { FounderIntakeForm } from "~/components/startup/founder-intake-form";
import { SiteShell } from "~/components/startup/site-shell";

export default function FounderPage() {
	return (
		<SiteShell>
			<main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
				<div className="mb-8 max-w-3xl">
					<p className="font-medium text-emerald-700 text-sm">
						Founder Navigator
					</p>
					<h1 className="mt-2 font-semibold text-4xl tracking-normal">
						Tell us what you are building.
					</h1>
					<p className="mt-3 text-muted-foreground">
						In about two minutes, Startup State Navigator will rank Utah
						resources against your stage, region, sector, and goals.
					</p>
				</div>
				<div className="rounded-lg border bg-slate-50 p-5 shadow-sm sm:p-8">
					<FounderIntakeForm />
				</div>
			</main>
		</SiteShell>
	);
}
