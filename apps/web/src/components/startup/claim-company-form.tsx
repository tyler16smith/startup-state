"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { apiClient } from "~/lib/startup-api";

export function ClaimCompanyForm({ companyId }: { companyId: string }) {
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	async function submit(formData: FormData) {
		setSaving(true);
		setMessage(null);
		try {
			await apiClient(`/api/v1/companies/claim`, {
				method: "POST",
				body: JSON.stringify({
					companyId,
					workEmail: formData.get("workEmail"),
					explanation: formData.get("explanation"),
				}),
			});
			setMessage("Claim submitted for admin review.");
		} catch (error) {
			setMessage(
				error instanceof Error ? error.message : "Could not submit claim",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<form
			action={submit}
			className="space-y-5 rounded-lg border bg-white p-6 shadow-sm"
		>
			<div>
				<h2 className="font-semibold text-2xl">Claim this listing</h2>
				<p className="mt-2 text-muted-foreground text-sm">
					Use a work email and a short explanation so an admin can verify
					ownership.
				</p>
			</div>
			<div className="space-y-2">
				<Label>Work email</Label>
				<Input
					name="workEmail"
					placeholder="you@company.com"
					required
					type="email"
				/>
			</div>
			<div className="space-y-2">
				<Label>Explanation</Label>
				<Textarea name="explanation" rows={5} />
			</div>
			{message && <p className="text-emerald-700 text-sm">{message}</p>}
			<Button disabled={saving} type="submit">
				{saving ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<ShieldCheck className="size-4" />
				)}{" "}
				Submit claim
			</Button>
		</form>
	);
}
