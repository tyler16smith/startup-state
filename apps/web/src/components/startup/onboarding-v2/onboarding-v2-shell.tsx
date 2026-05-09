"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { VersionSelect } from "./version-select";

type OnboardingV2ShellProps = {
	children: React.ReactNode;
	nextDisabled: boolean;
	onBack: () => void;
	onNext: () => void;
	title: string;
};

export function OnboardingV2Shell({
	children,
	nextDisabled,
	onBack,
	onNext,
	title,
}: OnboardingV2ShellProps) {
	return (
		<main className="min-h-screen bg-white text-slate-950">
			<header className="fixed inset-x-0 top-0 z-30 border-slate-200 border-b bg-white/95 backdrop-blur">
				<div className="flex h-16 items-center justify-between px-4 sm:px-6">
					<div className="flex items-center gap-3">
						<VersionSelect value="v2" />
						<Link className="font-semibold text-sm" href="/?choosePath=1&v=2">
							Startup State
						</Link>
					</div>
					<Button asChild size="sm" variant="ghost">
						<Link href="/resources">Skip</Link>
					</Button>
				</div>
				<div className="h-0.5 bg-slate-950" />
			</header>

			<section className="px-4 pt-24 pb-28 sm:px-6">
				<div className="mx-auto w-full max-w-5xl space-y-8">
					<div className="space-y-2 text-center">
						<h1 className="font-semibold text-2xl tracking-normal sm:text-3xl">
							{title}
						</h1>
					</div>
					{children}
				</div>
			</section>

			<footer className="fixed inset-x-0 bottom-0 z-30 border-slate-200 border-t bg-white/95 backdrop-blur">
				<div className="flex h-16 items-center justify-between px-4 sm:px-6">
					<Button onClick={onBack} type="button" variant="ghost">
						<ArrowLeft className="size-4" /> Back
					</Button>
					<Button disabled={nextDisabled} onClick={onNext} type="button">
						Load recommendations <ArrowRight className="size-4" />
					</Button>
				</div>
			</footer>
		</main>
	);
}
