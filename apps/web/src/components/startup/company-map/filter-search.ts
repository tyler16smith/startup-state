import type { FilterOption } from "~/components/startup/company-map/types";

type FilterSuggestionInput = {
	inputValue: string;
	label: string;
	options: FilterOption[];
	value: string;
};

export function fuzzyScore(text: string, query: string): number | null {
	const haystack = text.toLowerCase();
	const needle = query.toLowerCase();
	let score = 0;
	let index = 0;

	for (const character of needle) {
		const foundIndex = haystack.indexOf(character, index);
		if (foundIndex === -1) return null;
		score += foundIndex === index ? 2 : 1;
		index = foundIndex + 1;
	}

	return score;
}

export function getFilterSuggestions({
	inputValue,
	label,
	options,
	value,
}: FilterSuggestionInput) {
	const query = inputValue.trim();
	const allOptions = value
		? [{ label: `All ${label.toLowerCase()}`, value: "" }, ...options]
		: options;
	if (!query) return allOptions.slice(0, 5);

	return allOptions
		.map((option) => ({ ...option, score: fuzzyScore(option.label, query) }))
		.filter(
			(option): option is FilterOption & { score: number } =>
				option.score !== null,
		)
		.sort((first, second) => second.score - first.score)
		.slice(0, 5);
}
