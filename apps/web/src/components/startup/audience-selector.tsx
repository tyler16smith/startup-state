"use client";

import { Building2, Hammer, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const audiences = [
	{
		id: "founder",
		label: "I'm a founder",
		description:
			"Founders, Utah has so many resources for you. It's about time you found them.",
		href: "/founder",
		icon: Hammer,
	},
	{
		id: "investor",
		label: "I'm an investor",
		description:
			"Investors, Utah is building. And it's about time you found out.",
		href: "/investor",
		icon: Building2,
	},
] as const;

export function AudienceSelector() {
	const [selected, setSelected] = useState<string | null>(null);

	return (
		<main className="min-h-screen bg-white text-slate-950">
			<header className="fixed inset-x-0 top-0 z-30 border-slate-200 border-b bg-white/95 backdrop-blur">
				<div className="flex h-16 items-center justify-between px-4 sm:px-6">
					<Link className="font-semibold text-sm" href="/">
						Startup State
					</Link>
					<Button asChild size="sm" variant="ghost">
						<Link href="/auth/signin?callbackUrl=/plan">Sign in</Link>
					</Button>
				</div>
				<div className="h-0.5 w-1/3 bg-slate-950" />
			</header>

			<section className="flex min-h-screen items-center justify-center px-4 py-20">
				<div className="mx-auto w-full max-w-3xl space-y-7">
					<div className="space-y-2 text-center">
						<h1 className="font-semibold text-2xl tracking-normal sm:text-3xl">
							What brings you to Startup State?
						</h1>
						<p className="text-muted-foreground text-sm sm:text-base">
							Choose a path and we&apos;ll shape the experience around it.
						</p>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						{audiences.map(({ id, label, description, href, icon: Icon }) => (
							<Link
								className={cn(
									"flex min-h-36 flex-col items-center justify-center gap-3 rounded-lg border-2 bg-white p-6 text-center transition-all hover:bg-emerald-50",
									selected === id
										? "border-emerald-900 bg-emerald-50"
										: "border-gray-200",
								)}
								href={href}
								key={id}
								onClick={() => setSelected(id)}
							>
								<Icon
									className={cn(
										"size-7",
										selected === id ? "text-emerald-800" : "text-slate-700",
									)}
								/>
								<span className="font-semibold text-lg sm:text-xl">
									{label}
								</span>
								<span className="max-w-64 text-muted-foreground text-sm">
									{description}
								</span>
							</Link>
						))}
					</div>

					<div className="text-center">
						<Button asChild variant="link">
							<Link href="/explore">
								<Search className="size-4" /> I&apos;m just exploring
							</Link>
						</Button>
					</div>
				</div>
			</section>

			<footer className="fixed inset-x-0 bottom-0 z-30 border-slate-200 border-t bg-white/95 backdrop-blur">
				<div className="flex h-16 items-center justify-center px-4 text-sm">
					<span className="text-muted-foreground">Have an account?</span>
					<Button asChild className="px-2" variant="link">
						<Link href="/auth/signin?callbackUrl=/plan">Sign in</Link>
					</Button>
				</div>
			</footer>
		</main>
	);
}
