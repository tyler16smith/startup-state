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
			className="absolute right-[8px] bottom-26 z-10 flex size-[38px] cursor-pointer items-center justify-center rounded-md border-2 border-gray-300 bg-white text-slate-700 shadow-lg transition hover:bg-gray-200 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2"
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
