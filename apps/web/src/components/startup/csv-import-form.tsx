"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { apiClient } from "~/lib/startup-api";

export function CsvImportForm({ endpoint }: { endpoint: string }) {
	const router = useRouter();
	const [csv, setCsv] = useState("");
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	async function submit() {
		setSaving(true);
		setMessage(null);
		try {
			const result = await apiClient<{ imported: number; errors: string[] }>(
				endpoint,
				{
					method: "POST",
					body: JSON.stringify({ csv }),
				},
			);
			setMessage(
				`Imported ${result.imported} rows${result.errors.length ? ` with ${result.errors.length} errors` : ""}.`,
			);
			router.refresh();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Import failed");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-3 rounded-lg border bg-white p-5 shadow-sm">
			<div>
				<h2 className="font-semibold">CSV import</h2>
				<p className="text-muted-foreground text-sm">
					Paste CSV rows from the hackathon data source.
				</p>
			</div>
			<Textarea
				onChange={(event) => setCsv(event.target.value)}
				placeholder="name,description,website,category..."
				rows={7}
				value={csv}
			/>
			{message && <p className="text-muted-foreground text-sm">{message}</p>}
			<Button disabled={!csv.trim() || saving} onClick={submit} type="button">
				{saving ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Upload className="size-4" />
				)}{" "}
				Import
			</Button>
		</div>
	);
}
