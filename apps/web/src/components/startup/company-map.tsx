"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { Filter, Loader2, MapPinned, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CompanyCard } from "~/components/startup/company-card";
import { EmptyState } from "~/components/startup/empty-state";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { apiClient, type Company, type Paginated } from "~/lib/startup-api";

export function CompanyMap({ token }: { token?: string }) {
	const mapRef = useRef<HTMLDivElement | null>(null);
	const [companies, setCompanies] = useState<Company[]>([]);
	const [selected, setSelected] = useState<Company | null>(null);
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [sector, setSector] = useState("");
	const [stage, setStage] = useState("");
	const [hiringStatus, setHiringStatus] = useState("");
	const [city, setCity] = useState("");
	const [size, setSize] = useState("");

	useEffect(() => {
		apiClient<Paginated<Company>>("/api/v1/companies/list?limit=100")
			.then((data) => setCompanies(data.items))
			.finally(() => setLoading(false));
	}, []);

	const filtered = useMemo(() => {
		return companies.filter((company) => {
			const haystack =
				`${company.name} ${company.description ?? ""} ${company.city ?? ""} ${company.county ?? ""} ${company.sector ?? ""}`.toLowerCase();
			const employeeCount = company.employees ?? null;
			const sizeMatches =
				!size ||
				(size === "1-10" && employeeCount !== null && employeeCount <= 10) ||
				(size === "11-50" &&
					employeeCount !== null &&
					employeeCount >= 11 &&
					employeeCount <= 50) ||
				(size === "51-200" &&
					employeeCount !== null &&
					employeeCount >= 51 &&
					employeeCount <= 200) ||
				(size === "201+" && employeeCount !== null && employeeCount >= 201) ||
				Boolean(company.employeeRange?.toLowerCase() === size.toLowerCase());
			return (
				(!query || haystack.includes(query.toLowerCase())) &&
				(!sector || company.sector?.toLowerCase() === sector.toLowerCase()) &&
				(!stage || company.stage?.toLowerCase() === stage.toLowerCase()) &&
				(!hiringStatus || company.hiringStatus === hiringStatus) &&
				(!city || company.city?.toLowerCase() === city.toLowerCase()) &&
				sizeMatches
			);
		});
	}, [city, companies, hiringStatus, query, sector, size, stage]);

	useEffect(() => {
		if (!token || !mapRef.current || !filtered.length) return;
		let cleanup = () => {};
		void import("mapbox-gl").then((mapboxgl) => {
			mapboxgl.default.accessToken = token;
			const map = new mapboxgl.default.Map({
				container: mapRef.current as HTMLDivElement,
				style: "mapbox://styles/mapbox/light-v11",
				center: [-111.891, 39.321],
				zoom: 5.8,
			});

			const markers = filtered
				.filter((company) => company.latitude && company.longitude)
				.map((company) => {
					const marker = new mapboxgl.default.Marker({
						color:
							company.hiringStatus === "ACTIVELY_HIRING"
								? "#059669"
								: "#0f172a",
					})
						.setLngLat([
							company.longitude as number,
							company.latitude as number,
						])
						.addTo(map);
					marker
						.getElement()
						.addEventListener("click", () => setSelected(company));
					return marker;
				});

			cleanup = () => {
				for (const marker of markers) marker.remove();
				map.remove();
			};
		});
		return () => cleanup();
	}, [filtered, token]);

	const sectors = Array.from(
		new Set(companies.map((company) => company.sector).filter(Boolean)),
	) as string[];
	const stages = Array.from(
		new Set(companies.map((company) => company.stage).filter(Boolean)),
	) as string[];
	const cities = Array.from(
		new Set(companies.map((company) => company.city).filter(Boolean)),
	) as string[];

	if (loading) {
		return (
			<div className="flex min-h-96 items-center justify-center rounded-lg border bg-white">
				<Loader2 className="mr-2 size-5 animate-spin" /> Loading Utah companies
			</div>
		);
	}

	return (
		<div className="grid min-h-[42rem] gap-4 lg:grid-cols-[23rem_1fr]">
			<aside className="rounded-lg border bg-white p-4 shadow-sm">
				<div className="mb-4 flex items-center gap-2 font-semibold">
					<Filter className="size-4" /> Ecosystem filters
				</div>
				<div className="space-y-3">
					<div className="relative">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="pl-9"
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search companies"
							value={query}
						/>
					</div>
					<select
						className="h-9 w-full rounded-md border bg-white px-3 text-sm"
						onChange={(event) => setSector(event.target.value)}
						value={sector}
					>
						<option value="">All sectors</option>
						{sectors.map((item) => (
							<option key={item} value={item}>
								{item}
							</option>
						))}
					</select>
					<select
						className="h-9 w-full rounded-md border bg-white px-3 text-sm"
						onChange={(event) => setStage(event.target.value)}
						value={stage}
					>
						<option value="">All stages</option>
						{stages.map((item) => (
							<option key={item} value={item}>
								{item.replace(/_/g, " ").toLowerCase()}
							</option>
						))}
					</select>
					<select
						className="h-9 w-full rounded-md border bg-white px-3 text-sm"
						onChange={(event) => setHiringStatus(event.target.value)}
						value={hiringStatus}
					>
						<option value="">All hiring</option>
						<option value="ACTIVELY_HIRING">actively hiring</option>
						<option value="HIRING">hiring</option>
						<option value="NOT_HIRING">not hiring</option>
						<option value="UNKNOWN">unknown</option>
					</select>
					<select
						className="h-9 w-full rounded-md border bg-white px-3 text-sm"
						onChange={(event) => setCity(event.target.value)}
						value={city}
					>
						<option value="">All cities</option>
						{cities.map((item) => (
							<option key={item} value={item}>
								{item}
							</option>
						))}
					</select>
					<select
						className="h-9 w-full rounded-md border bg-white px-3 text-sm"
						onChange={(event) => setSize(event.target.value)}
						value={size}
					>
						<option value="">All sizes</option>
						<option value="1-10">1-10</option>
						<option value="11-50">11-50</option>
						<option value="51-200">51-200</option>
						<option value="201+">201+</option>
					</select>
				</div>
				<div className="mt-5 space-y-3 overflow-y-auto pr-1 lg:max-h-[33rem]">
					{filtered.map((company) => (
						<button
							className="w-full rounded-lg border p-3 text-left transition hover:border-emerald-500 hover:bg-emerald-50"
							key={company.id}
							onClick={() => setSelected(company)}
							type="button"
						>
							<p className="font-medium">{company.name}</p>
							<p className="text-muted-foreground text-sm">
								{[company.sector, company.city].filter(Boolean).join(" · ")}
							</p>
						</button>
					))}
				</div>
			</aside>
			<section className="relative overflow-hidden rounded-lg border bg-white shadow-sm">
				{filtered.length === 0 ? (
					<div className="p-6">
						<EmptyState
							description="Adjust your filters or add a company listing for this part of the ecosystem."
							icon={MapPinned}
							title="No companies found for this view"
						/>
					</div>
				) : token ? (
					<div className="h-[42rem]" ref={mapRef} />
				) : (
					<div className="p-6">
						<EmptyState
							description="Map view needs a Mapbox token. You can still browse companies below."
							icon={MapPinned}
							title="Mapbox token missing"
						/>
					</div>
				)}
				{selected && (
					<div className="absolute right-4 bottom-4 left-4 max-w-md rounded-lg border bg-white p-4 shadow-lg">
						<p className="font-semibold text-lg">{selected.name}</p>
						<p className="mt-1 text-muted-foreground text-sm">
							{[selected.sector, selected.city, selected.employeeRange]
								.filter(Boolean)
								.join(" · ")}
						</p>
						<div className="mt-3 flex gap-2">
							<Button asChild size="sm">
								<Link href={`/companies/${selected.id}`}>Open profile</Link>
							</Button>
							<Button
								onClick={() => setSelected(null)}
								size="sm"
								variant="outline"
							>
								Close
							</Button>
						</div>
					</div>
				)}
			</section>
			{!token && filtered.length ? (
				<div className="grid gap-5 md:grid-cols-2 lg:col-span-2 xl:grid-cols-3">
					{filtered.map((company) => (
						<CompanyCard company={company} key={company.id} />
					))}
				</div>
			) : null}
		</div>
	);
}
