"use client";

import { LockKeyhole, Save } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";

export function SavePlanDialog({
	open,
	onOpenChange,
	callbackUrl,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	callbackUrl: string;
}) {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
						<LockKeyhole className="size-5" />
					</div>
					<DialogTitle>Sign in to save this plan</DialogTitle>
					<DialogDescription>
						Your recommendations are ready to use now. Sign in to save this
						result to your account and make it your homepage.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button asChild className="w-full">
						<Link
							href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
						>
							<Save className="size-4" /> Sign in and save
						</Link>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
