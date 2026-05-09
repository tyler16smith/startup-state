"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";

const stepVariants: Variants = {
	enter: (direction: number) => ({ opacity: 0, x: direction > 0 ? 48 : -48 }),
	center: { opacity: 1, x: 0 },
	exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? -48 : 48 }),
};

export function NavigatorShell({
	children,
	step,
	totalSteps,
	direction,
	onBack,
	onNext,
	nextDisabled,
	nextLabel = "Next",
	brandLabel = "Startup State",
}: {
	children: React.ReactNode;
	step: number;
	totalSteps: number;
	direction: number;
	onBack?: () => void;
	onNext: () => void;
	nextDisabled?: boolean;
	nextLabel?: string;
	brandLabel?: string;
}) {
	const progress = ((step + 1) / totalSteps) * 100;

	return (
		<main className="min-h-screen bg-white text-slate-950">
			<header className="fixed inset-x-0 top-0 z-30 border-slate-200 border-b bg-white/95 backdrop-blur">
				<div className="flex h-16 items-center justify-between px-4 sm:px-6">
					<Link className="font-semibold text-sm" href="/">
						{brandLabel}
					</Link>
					<p className="font-medium text-muted-foreground text-xs sm:text-sm">
						Step {step + 1} of {totalSteps}
					</p>
					<Button asChild size="sm" variant="ghost">
						<Link href="/resources">Skip</Link>
					</Button>
				</div>
				<div className="h-0.5 bg-slate-200">
					<div
						className="h-full bg-slate-950 transition-all duration-300"
						style={{ width: `${progress}%` }}
					/>
				</div>
			</header>

			<section className="flex min-h-screen items-center justify-center overflow-hidden px-4 py-20 sm:px-6">
				<AnimatePresence custom={direction} mode="wait">
					<motion.div
						animate="center"
						className="w-full"
						custom={direction}
						exit="exit"
						initial="enter"
						key={step}
						transition={{ duration: 0.22, ease: "easeOut" }}
						variants={stepVariants}
					>
						{children}
					</motion.div>
				</AnimatePresence>
			</section>

			<footer className="fixed inset-x-0 bottom-0 z-30 border-slate-200 border-t bg-white/95 backdrop-blur">
				<div className="flex h-16 items-center justify-between px-4 sm:px-6">
					<Button disabled={!onBack} onClick={onBack} variant="ghost">
						<ArrowLeft className="size-4" /> Back
					</Button>
					<Button disabled={nextDisabled} onClick={onNext}>
						{nextLabel} <ArrowRight className="size-4" />
					</Button>
				</div>
			</footer>
		</main>
	);
}
