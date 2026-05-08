import { Search, X } from "lucide-react";
import { Input } from "~/components/ui/input";

type MapSearchInputProps = {
	onFocus: () => void;
	onQueryChange: (value: string) => void;
	query: string;
};

export function MapSearchInput({
	onFocus,
	onQueryChange,
	query,
}: MapSearchInputProps) {
	return (
		<div className="relative w-full md:max-w-96">
			<Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-500" />
			<Input
				className="h-10 rounded-full border-2 border-gray-200 border-slate-200 bg-white pr-11 pl-12 text-base shadow-lg"
				onChange={(event) => onQueryChange(event.target.value)}
				onFocus={onFocus}
				placeholder="Search Utah companies"
				value={query}
			/>
			{query && (
				<button
					aria-label="Clear search"
					className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
					onClick={() => onQueryChange("")}
					type="button"
				>
					<X className="size-4" />
				</button>
			)}
		</div>
	);
}
