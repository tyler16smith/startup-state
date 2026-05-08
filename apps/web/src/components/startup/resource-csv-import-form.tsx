"use client";

import { Download, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import {
	apiClient,
	type ResourceImportCommitResult,
	type ResourceImportPreview,
} from "~/lib/startup-api";

export function ResourceCsvImportForm() {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [preview, setPreview] = useState<ResourceImportPreview | null>(null);
	const [result, setResult] = useState<ResourceImportCommitResult | null>(null);
	const [busy, setBusy] = useState(false);
	const [publishImmediately, setPublishImmediately] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	async function previewFile(file: File) {
		setBusy(true);
		setMessage(null);
		setResult(null);
		try {
			const csv = await file.text();
			const nextPreview = await apiClient<ResourceImportPreview>(
				"/api/v1/resources/importCsvPreview",
				{ method: "POST", body: JSON.stringify({ csv }) },
			);
			setPreview(nextPreview);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Preview failed");
		} finally {
			setBusy(false);
		}
	}

	async function commitImport() {
		if (!preview) return;
		setBusy(true);
		setMessage(null);
		try {
			const commitResult = await apiClient<ResourceImportCommitResult>(
				"/api/v1/resources/importCsvCommit",
				{
					method: "POST",
					body: JSON.stringify({
						importSessionId: preview.importSessionId,
						publishImmediately,
					}),
				},
			);
			setResult(commitResult);
			setPreview(null);
			router.refresh();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Import failed");
		} finally {
			setBusy(false);
		}
	}

	function downloadErrors() {
		const lines = [
			...(preview?.errors ?? []),
			...(result?.errors ?? []),
			...(preview?.rows.flatMap((row) =>
				row.errors.map((error) => `Row ${row.rowNumber}: ${error}`),
			) ?? []),
		];
		if (!lines.length) return;
		const url = URL.createObjectURL(
			new Blob([lines.join("\n")], { type: "text/plain" }),
		);
		const link = document.createElement("a");
		link.href = url;
		link.download = "resource-import-errors.txt";
		link.click();
		URL.revokeObjectURL(url);
	}

	const errorCount =
		(preview?.errors.length ?? 0) +
		(preview?.rows.reduce((count, row) => count + row.errors.length, 0) ?? 0) +
		(result?.errors.length ?? 0);

	return (
		<div className="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
			<div>
				<h2 className="font-semibold">CSV import</h2>
				<p className="text-muted-foreground text-sm">
					Upload, review, then commit Utah startup resource records.
				</p>
			</div>
			<Label className="sr-only" htmlFor="resource-csv-import">
				Resource CSV file
			</Label>
			<input
				accept=".csv,text/csv"
				className="hidden"
				id="resource-csv-import"
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) void previewFile(file);
					event.target.value = "";
				}}
				ref={fileInputRef}
				type="file"
			/>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					disabled={busy}
					onClick={() => fileInputRef.current?.click()}
					type="button"
					variant="outline"
				>
					{busy ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Upload className="size-4" />
					)}
					Choose CSV
				</Button>
				{errorCount > 0 && (
					<Button onClick={downloadErrors} type="button" variant="ghost">
						<Download className="size-4" />
						Error report
					</Button>
				)}
			</div>

			{message && (
				<p className="text-destructive text-sm" role="alert">
					{message}
				</p>
			)}

			{preview && (
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
						<Stat label="Rows" value={preview.totalRows} />
						<Stat label="New" value={preview.newResources} />
						<Stat label="Updates" value={preview.updatedResources} />
						<Stat label="Duplicates" value={preview.duplicateRows} />
						<Stat label="Invalid" value={preview.invalidRows} />
						<Stat label="Valid" value={preview.validRows} />
					</div>
					<TaxonomyPreview preview={preview} />
					<div className="flex items-center justify-between gap-3 rounded-md border bg-slate-50 px-3 py-2">
						<div>
							<Label
								className="font-medium text-sm"
								htmlFor="publish-import-now"
							>
								Publish immediately
							</Label>
							<p className="text-muted-foreground text-xs">
								Off keeps new imports in draft for review.
							</p>
						</div>
						<Switch
							checked={publishImmediately}
							id="publish-import-now"
							onCheckedChange={setPublishImmediately}
						/>
					</div>
					<div className="max-h-72 overflow-auto rounded-md border">
						<Table>
							<TableCaption>Preview of the first 50 imported rows</TableCaption>
							<TableHeader>
								<TableRow>
									<TableHead>Row</TableHead>
									<TableHead>Action</TableHead>
									<TableHead>Resource</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{preview.rows.slice(0, 50).map((row) => (
									<TableRow key={row.rowNumber}>
										<TableCell>{row.rowNumber}</TableCell>
										<TableCell>
											<Badge className="rounded-md" variant="outline">
												{row.action}
											</Badge>
										</TableCell>
										<TableCell>
											<p className="font-medium">{row.name ?? "Untitled"}</p>
											{row.existingResourceName && (
												<p className="text-muted-foreground text-xs">
													Matches {row.existingResourceName}
												</p>
											)}
											{row.errors.length ? (
												<p className="text-destructive text-xs">
													{row.errors.join(", ")}
												</p>
											) : null}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					<Button
						disabled={busy || preview.validRows === 0}
						onClick={commitImport}
						type="button"
					>
						{busy && <Loader2 className="size-4 animate-spin" />}
						Commit import
					</Button>
				</div>
			)}

			{result && (
				<p className="text-muted-foreground text-sm" role="status">
					Imported {result.imported} rows: {result.created} created and{" "}
					{result.updated} updated.
				</p>
			)}
		</div>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-md border bg-slate-50 p-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="font-semibold text-lg">{value}</p>
		</div>
	);
}

function TaxonomyPreview({ preview }: { preview: ResourceImportPreview }) {
	const groups = [
		["Communities", preview.newTaxonomyValues.communities],
		["Industries", preview.newTaxonomyValues.industries],
		["Locations", preview.newTaxonomyValues.locations],
		["Topics", preview.newTaxonomyValues.topics],
	] as const;
	const hasValues = groups.some(([, values]) => values.length);
	if (!hasValues) return null;
	return (
		<div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
			<p className="font-medium text-amber-950 text-sm">New taxonomy values</p>
			{groups.map(([label, values]) =>
				values.length ? (
					<p className="text-amber-950 text-xs" key={label}>
						<span className="font-medium">{label}:</span>{" "}
						{values.slice(0, 8).join(", ")}
						{values.length > 8 ? ` +${values.length - 8} more` : ""}
					</p>
				) : null,
			)}
		</div>
	);
}
