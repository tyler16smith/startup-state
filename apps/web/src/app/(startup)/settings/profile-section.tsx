"use client";

import { updateAccountProfile } from "@app/client-ts";
import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, Pencil } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { useBillingStatus } from "~/lib/hooks/use-billing-status";
import { SettingsSection } from "./settings-section";

export function ProfileSection() {
	const { data: session, update } = useSession();
	const { data: billingStatus } = useBillingStatus();
	const [open, setOpen] = useState(false);
	const [nameValue, setNameValue] = useState("");

	const name = session?.user?.name ?? "";
	const email = session?.user?.email ?? "";
	const initials = name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
	const isPaidSubscriber = billingStatus?.subscriptionStatus === "ACTIVE";

	function handleOpenChange(next: boolean) {
		if (next) {
			setNameValue(name);
		}
		setOpen(next);
	}

	const mutation = useMutation({
		mutationFn: async (newName: string) => {
			const res = await updateAccountProfile({ name: newName });
			if (res.status !== 200) {
				throw new Error("Failed to update profile");
			}
			return res.data.data;
		},
		onSuccess: async (data) => {
			await update({ name: data.name });
			toast.success("Profile updated");
			setOpen(false);
		},
		onError: () => {
			toast.error("Failed to update profile");
		},
	});

	function handleSave() {
		const trimmed = nameValue.trim();
		if (!trimmed) return;
		mutation.mutate(trimmed);
	}

	return (
		<SettingsSection title="Profile">
			<Card className="py-0">
				<CardContent className="flex items-center gap-4 p-6">
					<Avatar className="h-16 w-16 shrink-0">
						<AvatarImage alt={name} src={session?.user?.image ?? ""} />
						<AvatarFallback className="text-lg">{initials}</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1 space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<p className="truncate font-medium text-base">{name}</p>
							{isPaidSubscriber ? (
								<Badge className="gap-1" variant="secondary">
									<BadgeCheck className="h-3.5 w-3.5" />
									Pro
								</Badge>
							) : null}
						</div>
						<p className="truncate text-muted-foreground text-sm">{email}</p>
					</div>
					<Button
						className="ml-auto shrink-0"
						onClick={() => handleOpenChange(true)}
						size="icon"
						variant="ghost"
					>
						<Pencil className="h-4 w-4" />
						<span className="sr-only">Edit profile</span>
					</Button>
				</CardContent>
			</Card>

			<Dialog onOpenChange={handleOpenChange} open={open}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Edit profile</DialogTitle>
					</DialogHeader>

					<div className="flex flex-col items-center gap-3 py-2">
						<Avatar className="h-16 w-16">
							<AvatarImage alt={name} src={session?.user?.image ?? ""} />
							<AvatarFallback className="text-lg">{initials}</AvatarFallback>
						</Avatar>
						<p className="text-muted-foreground text-xs">
							Profile photo cannot be updated at this time.
						</p>
					</div>

					<div className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="edit-name">Name</Label>
							<Input
								id="edit-name"
								onChange={(e) => setNameValue(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSave();
								}}
								value={nameValue}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="edit-email">Email</Label>
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="cursor-not-allowed">
										<Input
											className="pointer-events-none select-none"
											disabled
											id="edit-email"
											value={email}
										/>
									</div>
								</TooltipTrigger>
								<TooltipContent>
									Email cannot be updated after account creation.
								</TooltipContent>
							</Tooltip>
						</div>
					</div>

					<div className="flex justify-end gap-2 pt-2">
						<Button onClick={() => setOpen(false)} variant="outline">
							Cancel
						</Button>
						<Button
							disabled={
								mutation.isPending ||
								nameValue.trim() === "" ||
								nameValue.trim() === name
							}
							onClick={handleSave}
						>
							{mutation.isPending ? "Saving…" : "Save"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</SettingsSection>
	);
}
