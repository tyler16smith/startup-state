"use client";

import { UploadCloud } from "lucide-react";
import { useState } from "react";
import { CsvImportDropZone } from "~/components/startup/csv-import-drop-zone";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export function AdminCreatePageHeader({
	endpoint,
	inputId,
	title,
	uploadTitle,
}: {
	endpoint: string;
	inputId: string;
	title: string;
	uploadTitle: string;
}) {
	const [open, setOpen] = useState(false);

	return (
		<div className="mb-8 space-y-4">
			<div className="flex items-center justify-between gap-4">
				<h1 className="font-semibold text-3xl tracking-normal sm:text-4xl">
					{title}
				</h1>
				<Button
					aria-expanded={open}
					onClick={() => setOpen((current) => !current)}
					type="button"
					variant="outline"
				>
					<UploadCloud className="size-4" />
					Bulk upload
				</Button>
			</div>
			<div
				className={cn(
					"grid transition-[grid-template-rows,opacity] duration-300 ease-out",
					open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
				)}
			>
				<div className="overflow-hidden">
					<CsvImportDropZone
						buttonClassName="h-20 rounded-lg"
						className="mb-0"
						endpoint={endpoint}
						inputId={inputId}
						title={uploadTitle}
					/>
				</div>
			</div>
		</div>
	);
}