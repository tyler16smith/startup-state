"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { apiClient } from "~/lib/startup-api";

export function CsvImportForm({ endpoint }: { endpoint: string }) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [messageType, setMessageType] = useState<"error" | "success" | null>(
		null,
	);
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dragCounterRef = useRef(0);

	const processFile = useCallback(
		async (file: File) => {
			const csv = await file.text();
			setSaving(true);
			setMessage(null);
			setMessageType(null);
			try {
				const result = await apiClient<{ imported: number; errors: string[] }>(
					endpoint,
					{ method: "POST", body: JSON.stringify({ csv }) },
				);
				setMessage(
					`Imported ${result.imported} rows${result.errors.length ? ` with ${result.errors.length} errors` : ""}.`,
				);
				setMessageType("success");
				router.refresh();
			} catch (error) {
				setMessage(error instanceof Error ? error.message : "Import failed");
				setMessageType("error");
			} finally {
				setSaving(false);
			}
		},
		[endpoint, router],
	);

	const processFileRef = useRef(processFile);
	useEffect(() => {
		processFileRef.current = processFile;
	}, [processFile]);

	useEffect(() => {
		const handleDragEnter = (e: DragEvent) => {
			e.preventDefault();
			dragCounterRef.current += 1;
			if (dragCounterRef.current === 1) setIsDragging(true);
		};

		const handleDragLeave = (e: DragEvent) => {
			e.preventDefault();
			dragCounterRef.current -= 1;
			if (dragCounterRef.current === 0) setIsDragging(false);
		};

		const handleDragOver = (e: DragEvent) => {
			e.preventDefault();
		};

		const handleDrop = (e: DragEvent) => {
			e.preventDefault();
			dragCounterRef.current = 0;
			setIsDragging(false);
			const file = e.dataTransfer?.files?.[0];
			if (file) void processFileRef.current(file);
		};

		document.addEventListener("dragenter", handleDragEnter);
		document.addEventListener("dragleave", handleDragLeave);
		document.addEventListener("dragover", handleDragOver);
		document.addEventListener("drop", handleDrop);

		return () => {
			document.removeEventListener("dragenter", handleDragEnter);
			document.removeEventListener("dragleave", handleDragLeave);
			document.removeEventListener("dragover", handleDragOver);
			document.removeEventListener("drop", handleDrop);
		};
	}, []);

	return (
		<div className="space-y-3 rounded-lg border bg-white p-5 shadow-sm">
			<div>
				<h2 className="font-semibold">CSV import</h2>
				<p className="text-muted-foreground text-sm">
					Drag a CSV file anywhere on the screen, or click to upload.
				</p>
			</div>
			<Label className="sr-only" htmlFor="company-csv-import">
				Company CSV file
			</Label>
			<input
				accept=".csv,text/csv"
				className="hidden"
				id="company-csv-import"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) void processFile(file);
					e.target.value = "";
				}}
				ref={fileInputRef}
				type="file"
			/>
			<Button
				disabled={saving}
				onClick={() => fileInputRef.current?.click()}
				type="button"
			>
				{saving ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<Upload className="size-4" />
				)}{" "}
				{saving ? "Importing..." : "Choose CSV file"}
			</Button>
			{message && (
				<p
					className={
						messageType === "error"
							? "text-destructive text-sm"
							: "text-muted-foreground text-sm"
					}
					role={messageType === "error" ? "alert" : "status"}
				>
					{message}
				</p>
			)}

			{isDragging && (
				<div
					aria-live="polite"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
					role="status"
				>
					<div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-white/60 border-dashed bg-white/10 px-20 py-16 text-white backdrop-blur-sm">
						<Upload className="size-14 opacity-80" />
						<p className="font-semibold text-2xl">Drop CSV to import</p>
					</div>
				</div>
			)}
		</div>
	);
}
