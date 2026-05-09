"use client";

import { Loader2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "~/lib/startup-api";
import { cn } from "~/lib/utils";

type CsvImportResult = {
	imported: number;
	created?: number;
	updated?: number;
	errors: string[];
};

type ImportState = "idle" | "uploading";

function hasDraggedFiles(event: DragEvent) {
	return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export function PageDropOverlay() {
	return (
		<div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-emerald-50/95 p-8">
			<div className="flex h-full w-full flex-col items-center justify-center gap-6 rounded-2xl border-4 border-emerald-400 border-dashed">
				<UploadCloud aria-hidden="true" className="size-24 text-emerald-500" />
				<p className="font-semibold text-3xl text-emerald-700">
					Drop CSV to import
				</p>
				<p className="text-emerald-600 text-lg">
					Release anywhere on this page
				</p>
			</div>
		</div>
	);
}

export function CsvImportDropZone({
	buttonClassName,
	className,
	endpoint,
	inputId,
	title,
}: {
	buttonClassName?: string;
	className?: string;
	endpoint: string;
	inputId: string;
	title: string;
}) {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dragCounterRef = useRef(0);
	const [state, setState] = useState<ImportState>("idle");
	const [isPageDragOver, setIsPageDragOver] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [messageType, setMessageType] = useState<"error" | "success" | null>(
		null,
	);

	const processFile = useCallback(
		async (file: File) => {
			const csv = await file.text();
			setState("uploading");
			setMessage(null);
			setMessageType(null);
			try {
				const result = await apiClient<CsvImportResult>(endpoint, {
					method: "POST",
					body: JSON.stringify({ csv }),
				});
				const details =
					result.created !== undefined && result.updated !== undefined
						? `: ${result.created} created and ${result.updated} updated`
						: "";
				setMessage(
					`Imported ${result.imported} rows${details}${
						result.errors.length ? ` with ${result.errors.length} errors` : ""
					}.`,
				);
				setMessageType("success");
				router.refresh();
			} catch (error) {
				setMessage(error instanceof Error ? error.message : "Import failed");
				setMessageType("error");
			} finally {
				setState("idle");
			}
		},
		[endpoint, router],
	);

	const processFileRef = useRef(processFile);
	useEffect(() => {
		processFileRef.current = processFile;
	}, [processFile]);

	useEffect(() => {
		const handleDragEnter = (event: DragEvent) => {
			if (!hasDraggedFiles(event)) return;
			event.preventDefault();
			dragCounterRef.current += 1;
			if (dragCounterRef.current === 1) setIsPageDragOver(true);
		};

		const handleDragLeave = (event: DragEvent) => {
			if (!hasDraggedFiles(event)) return;
			event.preventDefault();
			dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
			if (dragCounterRef.current === 0) setIsPageDragOver(false);
		};

		const handleDragOver = (event: DragEvent) => {
			if (!hasDraggedFiles(event)) return;
			event.preventDefault();
		};

		const handleDrop = (event: DragEvent) => {
			if (!hasDraggedFiles(event)) return;
			event.preventDefault();
			dragCounterRef.current = 0;
			setIsPageDragOver(false);
			const file = event.dataTransfer?.files?.[0];
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
		<div className={cn("mb-6 space-y-2", className)}>
			{isPageDragOver && state === "idle" && <PageDropOverlay />}
			<input
				accept=".csv,text/csv"
				className="hidden"
				id={inputId}
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) void processFile(file);
					event.target.value = "";
				}}
				ref={fileInputRef}
				type="file"
			/>
			<button
				className={cn(
					"flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 border-dashed bg-emerald-50 px-4 font-medium text-emerald-800 text-sm transition-colors hover:border-emerald-500 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70",
					buttonClassName,
				)}
				disabled={state === "uploading"}
				onClick={() => fileInputRef.current?.click()}
				type="button"
			>
				{state === "uploading" ? (
					<Loader2 aria-hidden="true" className="size-4 animate-spin" />
				) : (
					<UploadCloud aria-hidden="true" className="size-4" />
				)}
				{state === "uploading" ? "Importing..." : title}
			</button>
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
		</div>
	);
}
