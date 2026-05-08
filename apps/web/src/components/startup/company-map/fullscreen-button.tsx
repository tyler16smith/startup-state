import { Maximize2, Minimize2 } from "lucide-react";

type FullscreenButtonProps = {
	isFullscreen: boolean;
	onToggle: () => void;
};

export function FullscreenButton({
	isFullscreen,
	onToggle,
}: FullscreenButtonProps) {
	return (
		<button
			aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
			className="absolute right-3 bottom-24 z-10 flex size-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
			onClick={onToggle}
			type="button"
		>
			{isFullscreen ? (
				<Minimize2 className="size-4" />
			) : (
				<Maximize2 className="size-4" />
			)}
		</button>
	);
}
