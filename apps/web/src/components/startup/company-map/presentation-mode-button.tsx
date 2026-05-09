import { Presentation } from "lucide-react";

type PresentationModeButtonProps = {
	isPresentationMode: boolean;
	onToggle: () => void;
};

export function PresentationModeButton({
	isPresentationMode,
	onToggle,
}: PresentationModeButtonProps) {
	return (
		<button
			aria-label={
				isPresentationMode
					? "Exit presentation mode"
					: "Enter presentation mode"
			}
			aria-pressed={isPresentationMode}
			className={[
				"absolute right-[8px] z-10 flex size-[38px] cursor-pointer items-center justify-center rounded-md border-2 border-gray-300 shadow-lg transition focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2",
				isPresentationMode
					? "bottom-[8px] border-slate-950 bg-slate-950 text-white hover:bg-slate-800"
					: "bottom-[150px] bg-white text-slate-700 hover:bg-gray-200 hover:text-slate-950",
			].join(" ")}
			onClick={onToggle}
			type="button"
		>
			<Presentation className="size-4" />
		</button>
	);
}
