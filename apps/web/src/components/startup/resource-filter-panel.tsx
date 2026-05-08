"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
	type FormEvent,
	useEffect,
	useMemo,
	useState,
	useTransition,
} from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import type { ResourceTaxonomy } from "~/lib/startup-api";

export type ResourceFilterSelection = {
	q?: string;
	community: string[];
	industry: string[];
	location: string[];
	topic: string[];
};

type ResourceArrayFilterKey = Exclude<keyof ResourceFilterSelection, "q">;

const filterConfig = [
	{ key: "community", label: "Community", taxonomyKey: "communities" },
	{ key: "industry", label: "Industry", taxonomyKey: "industries" },
	{ key: "location", label: "Location", taxonomyKey: "locations" },
	{ key: "topic", label: "Topic", taxonomyKey: "topics" },
] as const;

export function ResourceFilterPanel({
	onPendingChange,
	taxonomy,
	selected,
}: {
	onPendingChange?: (isPending: boolean) => void;
	taxonomy: ResourceTaxonomy;
	selected: ResourceFilterSelection;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();
	const [optimisticSelected, setOptimisticSelected] = useState(selected);
	const [searchValue, setSearchValue] = useState(selected.q ?? "");
	const activeFilters = useMemo(
		() =>
			filterConfig.flatMap((filter) =>
				optimisticSelected[filter.key].map((value) => ({
					key: filter.key,
					label: filter.label,
					value,
				})),
			),
		[optimisticSelected],
	);

	useEffect(() => {
		setOptimisticSelected(selected);
		setSearchValue(selected.q ?? "");
	}, [selected]);

	useEffect(() => {
		onPendingChange?.(isPending);
	}, [isPending, onPendingChange]);

	function pushParams(params: URLSearchParams) {
		params.delete("offset");
		const query = params.toString();
		startTransition(() => {
			router.push(query ? `${pathname}?${query}` : pathname);
		});
	}

	function setValues(key: ResourceArrayFilterKey, values: string[]) {
		const params = new URLSearchParams(searchParams.toString());
		params.delete(key);
		for (const value of values) params.append(key, value);
		setOptimisticSelected((current) => ({ ...current, [key]: values }));
		pushParams(params);
	}

	function toggleValue(key: ResourceArrayFilterKey, value: string) {
		const values = optimisticSelected[key];
		setValues(
			key,
			values.includes(value)
				? values.filter((item) => item !== value)
				: [...values, value],
		);
	}

	function submitSearch(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const query = String(formData.get("q") ?? "").trim();
		const params = new URLSearchParams(searchParams.toString());
		if (query) params.set("q", query);
		else params.delete("q");
		setOptimisticSelected((current) => ({
			...current,
			q: query || undefined,
		}));
		pushParams(params);
	}

	function removeFilter(key: ResourceArrayFilterKey, value: string) {
		const values = optimisticSelected[key];
		setValues(
			key,
			values.filter((item) => item !== value),
		);
	}

	function clearSearch() {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("q");
		setSearchValue("");
		setOptimisticSelected((current) => ({ ...current, q: undefined }));
		pushParams(params);
	}

	function clearAll() {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("q");
		for (const filter of filterConfig) params.delete(filter.key);
		setSearchValue("");
		setOptimisticSelected({
			community: [],
			industry: [],
			location: [],
			q: undefined,
			topic: [],
		});
		pushParams(params);
	}

	return (
		<div className="mb-6 min-w-0 space-y-3 rounded-lg border bg-white p-4 shadow-sm">
			<div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
				<form className="relative" onSubmit={submitSearch}>
					<Label className="sr-only" htmlFor="resource-search">
						Search resources
					</Label>
					<Search
						aria-hidden="true"
						className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						className="pr-20 pl-9"
						id="resource-search"
						name="q"
						onChange={(event) => setSearchValue(event.target.value)}
						placeholder="Search resources"
						value={searchValue}
					/>
					<Button
						className="absolute top-1 right-1 h-7"
						size="sm"
						type="submit"
					>
						Search
					</Button>
				</form>
				{filterConfig.map((filter) => (
					<FilterDropdown
						key={filter.key}
						label={filter.label}
						onToggle={(value) => toggleValue(filter.key, value)}
						options={taxonomy[filter.taxonomyKey]}
						selected={optimisticSelected[filter.key]}
					/>
				))}
			</div>
			{optimisticSelected.q || activeFilters.length ? (
				<div className="flex flex-wrap items-center gap-2">
					{optimisticSelected.q && (
						<FilterChip
							label="Search"
							onRemove={clearSearch}
							value={optimisticSelected.q}
						/>
					)}
					{activeFilters.map((filter) => (
						<FilterChip
							key={`${filter.key}:${filter.value}`}
							label={filter.label}
							onRemove={() => removeFilter(filter.key, filter.value)}
							value={filter.value}
						/>
					))}
					<Button onClick={clearAll} size="sm" type="button" variant="ghost">
						Clear all
					</Button>
				</div>
			) : null}
		</div>
	);
}

function FilterDropdown({
	label,
	options,
	selected,
	onToggle,
}: {
	label: string;
	options: string[];
	selected: string[];
	onToggle: (value: string) => void;
}) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button className="min-w-0 justify-between" type="button" variant="outline">
					<span className="truncate">
						{label}
						{selected.length ? ` (${selected.length})` : ""}
					</span>
					<ChevronDown className="size-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 p-2">
				<div className="max-h-72 space-y-1 overflow-auto">
					{options.length ? (
						options.map((option) => (
							<Label
								className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
								key={option}
							>
								<Checkbox
									checked={selected.includes(option)}
									onCheckedChange={() => onToggle(option)}
								/>
								<span className="line-clamp-2">{option}</span>
							</Label>
						))
					) : (
						<p className="px-2 py-6 text-center text-muted-foreground text-sm">
							No options yet
						</p>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

function FilterChip({
	label,
	value,
	onRemove,
}: {
	label: string;
	value: string;
	onRemove: () => void;
}) {
	return (
		<Badge
			className="max-w-full rounded-md border-border bg-slate-50 text-foreground"
			variant="outline"
		>
			<span className="text-muted-foreground">{label}</span>
			<span className="min-w-0 break-words">{value}</span>
			<button aria-label={`Remove ${value}`} onClick={onRemove} type="button">
				<X className="size-3" />
			</button>
		</Badge>
	);
}
