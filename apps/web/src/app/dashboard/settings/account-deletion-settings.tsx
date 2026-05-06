"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Download, Trash2 } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toApiUrl } from "~/lib/api-url";
import { SettingsSection } from "./settings-section";

type ExportData = {
	exportedAt: string;
	exportVersion: string;
	user: unknown;
	financialData: unknown;
	automation: unknown;
	investments: unknown;
	connectedAccounts: unknown;
	importSettings: unknown;
};

async function deleteAccount(input: {
	email: string;
	confirmation: boolean;
}): Promise<{ data: { success: boolean; message: string } }> {
	const res = await fetch(toApiUrl("/api/v1/account/deleteAccount"), {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const err = await res.json();
		throw new Error(err.error?.message || "Failed to delete account");
	}
	return res.json();
}

async function exportData(): Promise<{ data: ExportData }> {
	const res = await fetch(toApiUrl("/api/v1/account/exportData"), {
		credentials: "include",
	});
	if (!res.ok) throw new Error("Failed to export data");
	return res.json();
}

export function AccountDeletionSettings() {
	const { data: session } = useSession();

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [confirmed, setConfirmed] = useState(false);
	const [error, setError] = useState("");

	const deleteMutation = useMutation({
		mutationFn: deleteAccount,
		onSuccess: () => {
			// Sign out the user after account deletion
			void signOut({ callbackUrl: "/auth/signin?deleted=true" });
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : "Failed to delete account");
		},
	});

	const exportMutation = useMutation({
		mutationFn: exportData,
		onSuccess: (response) => {
			// Download the data as a JSON file
			const blob = new Blob([JSON.stringify(response.data, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `app-export-${new Date().toISOString().split("T")[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		},
		onError: (err) => {
			setError(err instanceof Error ? err.message : "Failed to export data");
		},
	});

	function handleDeleteSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		deleteMutation.mutate({ email, confirmation: confirmed });
	}

	function handleExport() {
		setError("");
		exportMutation.mutate();
	}

	function openDeleteDialog() {
		setEmail("");
		setConfirmed(false);
		setError("");
		setDeleteDialogOpen(true);
	}

	return (
		<>
			{/* Data Export Section */}
			<SettingsSection title="Data Export">
				<Card>
					<CardHeader>
						<div className="flex items-center gap-3">
							<Download className="h-5 w-5 text-muted-foreground" />
							<div>
								<CardTitle className="text-base">Download your data</CardTitle>
								<CardDescription>
									Export all your financial data, transactions, rules, and
									settings in JSON format.
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<Button
							disabled={exportMutation.isPending}
							onClick={handleExport}
							variant="outline"
						>
							{exportMutation.isPending ? "Exporting..." : "Export My Data"}
						</Button>
					</CardContent>
				</Card>
			</SettingsSection>

			{/* Account Deletion Section */}
			<SettingsSection title="Danger Zone">
				<Card className="border-destructive/50">
					<CardHeader>
						<div className="flex items-center gap-3">
							<Trash2 className="h-5 w-5 text-destructive" />
							<div>
								<CardTitle className="text-base text-destructive">
									Delete account
								</CardTitle>
								<CardDescription>
									Permanently delete your account and all associated data.
								</CardDescription>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground text-sm">
							Once you delete your account, there is no going back. This will
							immediately and permanently delete all your:
						</p>
						<ul className="list-inside list-disc text-muted-foreground text-sm">
							<li>Profile and account data</li>
							<li>Household memberships and invites</li>
							<li>Billing, referral, and extension sessions</li>
							<li>Saved settings and authentication state</li>
							<li>Categories, hashtags, and settings</li>
						</ul>
						<Button onClick={openDeleteDialog} variant="destructive">
							Delete My Account
						</Button>

						{error && <p className="text-destructive text-sm">{error}</p>}
					</CardContent>
				</Card>
			</SettingsSection>

			{/* Delete Confirmation Dialog */}
			<Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-destructive">
							Delete your account
						</DialogTitle>
						<DialogDescription>
							This action cannot be undone. Your account and all data will be
							permanently deleted immediately.
						</DialogDescription>
					</DialogHeader>
					<form className="space-y-4" onSubmit={handleDeleteSubmit}>
						<Alert variant="destructive">
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription>
								All your data will be permanently deleted. We recommend
								exporting your data first.
							</AlertDescription>
						</Alert>

						<div className="space-y-2">
							<Label htmlFor="delete-email">Enter your email to confirm</Label>
							<Input
								autoComplete="email"
								autoFocus
								id="delete-email"
								onChange={(e) => setEmail(e.target.value)}
								placeholder={session?.user?.email ?? "your@email.com"}
								required
								type="email"
								value={email}
							/>
						</div>

						<div className="flex items-start gap-2">
							<Checkbox
								checked={confirmed}
								id="confirm-delete"
								onCheckedChange={(checked) => setConfirmed(checked === true)}
							/>
							<Label className="text-sm leading-tight" htmlFor="confirm-delete">
								I understand that my account will be permanently deleted
								immediately and this action cannot be undone.
							</Label>
						</div>

						{error && <p className="text-destructive text-sm">{error}</p>}

						<div className="flex gap-2">
							<Button
								className="flex-1"
								onClick={() => setDeleteDialogOpen(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								className="flex-1"
								disabled={!confirmed || !email || deleteMutation.isPending}
								type="submit"
								variant="destructive"
							>
								{deleteMutation.isPending ? "Deleting..." : "Delete My Account"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
