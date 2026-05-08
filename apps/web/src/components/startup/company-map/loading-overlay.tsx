import { Loader2 } from "lucide-react";

export function LoadingOverlay() {
	return (
		<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/55 backdrop-blur-sm">
			<div className="flex items-center rounded-full border bg-white px-4 py-2 font-medium text-sm shadow-lg">
				<Loader2 className="mr-2 size-4 animate-spin" /> Loading Utah companies
			</div>
		</div>
	);
}
