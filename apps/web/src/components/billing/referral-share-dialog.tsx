"use client";

import { Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface ReferralShareDialogProps {
	referralLink: string;
	shareCopy: string;
	triggerClassName?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	showTrigger?: boolean;
}

export function ReferralShareDialog({
	referralLink,
	shareCopy,
	triggerClassName,
	open: controlledOpen,
	onOpenChange,
	showTrigger = true,
}: ReferralShareDialogProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const open = controlledOpen ?? internalOpen;

	function handleOpenChange(nextOpen: boolean) {
		if (controlledOpen === undefined) {
			setInternalOpen(nextOpen);
		}
		onOpenChange?.(nextOpen);
	}

	async function handleCopy() {
		await navigator.clipboard.writeText(referralLink);
		toast.success("Referral link copied");
	}

	async function handleNativeShare() {
		if (!navigator.share) {
			await handleCopy();
			return;
		}

		try {
			await navigator.share({
				text: `${shareCopy}\n\n${referralLink}`,
			});
			handleOpenChange(false);
		} catch {
			// User canceled share sheet.
		}
	}

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			{showTrigger ? (
				<DialogTrigger asChild>
					<Button className={triggerClassName} size="sm" variant="outline">
						<Share2 className="mr-1.5 h-3.5 w-3.5" />
						Share
					</Button>
				</DialogTrigger>
			) : null}
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Get up to 4 more weeks free</DialogTitle>
					<DialogDescription>
						Invite friends and <b>you'll both earn one free week</b> when they
						sign up. Share with up to four friends to unlock the full four week
						bonus.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<div className="space-y-1.5">
						<Label htmlFor="ref-link">Your referral link</Label>
						<Input id="ref-link" readOnly value={referralLink} />
					</div>
					<div className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
						{shareCopy}
					</div>
					<div className="flex items-center gap-2">
						<Button onClick={() => void handleCopy()} variant="secondary">
							<Copy className="mr-2 h-4 w-4" />
							Copy link
						</Button>
						<Button onClick={() => void handleNativeShare()}>
							<Share2 className="mr-2 h-4 w-4" />
							Share
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
