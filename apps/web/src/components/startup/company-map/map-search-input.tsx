import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "~/components/ui/input";

const STERLING_SNOW_SEARCH = "sterling snow";

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
	const handleQueryChange = (value: string) => {
		const normalizedValue = value.trim().toLowerCase();
		const normalizedQuery = query.trim().toLowerCase();

		if (
			normalizedValue === STERLING_SNOW_SEARCH &&
			normalizedQuery !== STERLING_SNOW_SEARCH
		) {
			toast("UTAH LFG!!!");
		}

		onQueryChange(value);
	};

	return (
		<div className="relative w-full md:max-w-96">
			<label className="sr-only" htmlFor="company-map-search">
				Search Utah companies
			</label>
			<Search
				aria-hidden="true"
				className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-500"
			/>
			<Input
				className="h-10 rounded-full border-2 border-gray-200 border-slate-200 bg-white pr-11 pl-12 text-base shadow-lg"
				id="company-map-search"
				onChange={(event) => handleQueryChange(event.target.value)}
				onFocus={onFocus}
				placeholder="Search Utah companies"
				value={query}
			/>
			{query && (
				<button
					aria-label="Clear search"
					className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
					onClick={() => handleQueryChange("")}
					type="button"
				>
					<X className="size-4" />
				</button>
			)}
		</div>
	);
}
