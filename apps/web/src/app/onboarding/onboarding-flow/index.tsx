"use client";

import { completeInitialOnboarding } from "@app/client-ts";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";

export type Prereqs = Record<string, never>;

export function OnboardingFlow() {
	const router = useRouter();
	const complete = useMutation({
		mutationFn: () => completeInitialOnboarding({}),
		onSuccess: (response) => {
			if (response.status !== 200) {
				toast.error("Unable to complete onboarding");
				return;
			}

			toast.success("Welcome in.");
			router.push("/dashboard");
		},
		onError: () => {
			toast.error("Unable to complete onboarding");
		},
	});

	return (
		<main className="flex min-h-screen items-center justify-center bg-background px-6">
			<section className="w-full max-w-xl space-y-6 text-center">
				<div className="space-y-3">
					<p className="font-medium text-muted-foreground text-sm">
						Hello world
					</p>
					<h1 className="font-semibold text-4xl tracking-normal">
						Hello world
					</h1>
					<p className="text-muted-foreground">
						Your app shell is ready. Authentication, settings, billing,
						households and the agent are still wired up for the next idea.
					</p>
				</div>
				<div className="flex flex-col items-center gap-3">
					<Button
						disabled={complete.isPending}
						onClick={() => complete.mutate()}
						size="lg"
					>
						Enter dashboard
						<ArrowRight className="h-4 w-4" />
					</Button>
					<button
						className="text-muted-foreground text-sm underline-offset-4 hover:underline disabled:opacity-50"
						disabled={complete.isPending}
						onClick={() => complete.mutate()}
						type="button"
					>
						Skip for now
					</button>
				</div>
			</section>
		</main>
	);
}
