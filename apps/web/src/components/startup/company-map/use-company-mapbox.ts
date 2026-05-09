"use client";

import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	COMPANY_CLUSTER_COUNT_LAYER_ID,
	COMPANY_CLUSTERS_LAYER_ID,
	COMPANY_SOURCE_ID,
} from "~/components/startup/company-map/constants";
import { getCompanyCoordinates } from "~/components/startup/company-map/map-data";
import {
	createCompanyMarkerElement,
	setCompanyMarkerSelected,
} from "~/components/startup/company-map/marker-element";
import type { CompanyFeatureCollection } from "~/components/startup/company-map/types";
import type { Company } from "~/lib/startup-api";

// ── Presentation mode: animated flight lines ─────────────────────────────────
const UTAH_ORIGIN: [number, number] = [-111.891, 39.321];
const FLIGHT_ARC_STEPS = 80;
const FLIGHT_CYCLE_MS = 10_000;
const FLIGHT_DRAW_MS = 1_400;
const FLIGHT_HOLD_MS = 400;
const FLIGHT_FADE_MS = 700;
const FLIGHT_TOTAL_MS = FLIGHT_DRAW_MS + FLIGHT_HOLD_MS + FLIGHT_FADE_MS;
const FLIGHT_SOURCE_ID = "presentation-flights";
const FLIGHT_GLOW_LAYER_ID = "presentation-flights-glow";
const FLIGHT_LINE_LAYER_ID = "presentation-flights-line";

const FLIGHT_DESTINATIONS: readonly [number, number][] = [
	[-0.118, 51.509], // London
	[139.691, 35.689], // Tokyo
	[151.209, -33.868], // Sydney
	[-46.633, -23.55], // São Paulo
	[72.877, 18.975], // Mumbai
	[18.424, -33.924], // Cape Town
	[-79.383, 43.653], // Toronto
	[-99.133, 19.432], // Mexico City
	[116.391, 39.907], // Beijing
	[13.405, 52.52], // Berlin
	[55.296, 25.204], // Dubai
	[103.82, 1.352], // Singapore
	[31.235, 30.044], // Cairo
	[-58.437, -34.603], // Buenos Aires
	[3.379, 6.524], // Lagos
	[37.618, 55.751], // Moscow
	[126.978, 37.566], // Seoul
	[-87.629, 41.878], // Chicago
	[-80.191, 25.775], // Miami
	[4.9, 52.367], // Amsterdam
	[36.817, -1.286], // Nairobi
	[106.845, -6.211], // Jakarta
	[-70.669, -33.456], // Santiago
	[46.738, 24.688], // Riyadh
	[2.349, 48.864], // Paris
];

function shuffleDestinations(
	arr: readonly [number, number][],
): [number, number][] {
	const result: [number, number][] = [...arr];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = result[i] as [number, number];
		result[i] = result[j] as [number, number];
		result[j] = tmp;
	}
	return result;
}

function unwrapLongitude(previousLongitude: number, longitude: number) {
	let unwrappedLongitude = longitude;
	while (unwrappedLongitude - previousLongitude > 180) {
		unwrappedLongitude -= 360;
	}
	while (unwrappedLongitude - previousLongitude < -180) {
		unwrappedLongitude += 360;
	}
	return unwrappedLongitude;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function computeFlightArc(
	from: [number, number],
	to: [number, number],
): [number, number][] {
	const targetLongitude = unwrapLongitude(from[0], to[0]);
	const longitudeDelta = targetLongitude - from[0];
	const latitudeDelta = to[1] - from[1];
	const routeDistance = Math.hypot(longitudeDelta, latitudeDelta);
	const bend = clamp(routeDistance * 0.18, 8, 24);
	const midpointLatitude = (from[1] + to[1]) / 2;
	const shouldBendSouth = Math.abs(longitudeDelta) > 60 || latitudeDelta < 0;
	const controlPoint: [number, number] = [
		(from[0] + targetLongitude) / 2,
		clamp(midpointLatitude + (shouldBendSouth ? -bend : bend), -45, 55),
	];
	const points: [number, number][] = [];

	for (let i = 0; i <= FLIGHT_ARC_STEPS; i++) {
		const t = i / FLIGHT_ARC_STEPS;
		const inverseT = 1 - t;
		points.push([
			inverseT * inverseT * from[0] +
				2 * inverseT * t * controlPoint[0] +
				t * t * targetLongitude,
			inverseT * inverseT * from[1] +
				2 * inverseT * t * controlPoint[1] +
				t * t * to[1],
		]);
	}

	return points;
}
// ─────────────────────────────────────────────────────────────────────────────

type UseCompanyMapboxParams = {
	companiesById: Map<string, Company>;
	companyFeatureCollection: CompanyFeatureCollection;
	isFullscreen: boolean;
	isPresentationMode: boolean;
	onCompanyClick: (company: Company) => void;
	selectedCompany?: Company | null;
	selectedCompanyId?: string;
	token?: string;
};

export function useCompanyMapbox({
	companiesById,
	companyFeatureCollection,
	isFullscreen,
	isPresentationMode,
	onCompanyClick,
	selectedCompany,
	selectedCompanyId,
	token,
}: UseCompanyMapboxParams) {
	const mapRef = useRef<HTMLDivElement | null>(null);
	const mapInstanceRef = useRef<MapboxMap | null>(null);
	const mapboxRef = useRef<typeof import("mapbox-gl").default | null>(null);
	const photoMarkersRef = useRef<Map<string, Marker>>(new Map());
	const selectedMarkerRef = useRef<Marker | null>(null);
	const clusterHandlersAttachedRef = useRef(false);
	const presentationFrameRef = useRef<number | null>(null);
	const flightFrameRef = useRef<number | null>(null);
	const [mapReady, setMapReady] = useState(false);

	const flyToCompany = useCallback((company: Company) => {
		const coordinates = getCompanyCoordinates(company);
		if (!coordinates) return;

		mapInstanceRef.current?.flyTo({
			center: coordinates,
			duration: 900,
			essential: true,
			zoom: 10.5,
		});
	}, []);

	const refreshSelectedMarker = useCallback(() => {
		for (const [companyId, marker] of photoMarkersRef.current) {
			setCompanyMarkerSelected(
				marker.getElement(),
				companyId === selectedCompanyId,
			);
		}
	}, [selectedCompanyId]);

	useEffect(() => {
		if (!token || !mapRef.current || mapInstanceRef.current) return;

		let cancelled = false;

		void import("mapbox-gl").then((mapboxgl) => {
			if (cancelled || !mapRef.current) return;

			mapboxgl.default.accessToken = token;
			mapboxRef.current = mapboxgl.default;

			const map = new mapboxgl.default.Map({
				center: [-111.891, 39.321],
				container: mapRef.current,
				projection: "globe",
				style: "mapbox://styles/mapbox/light-v11",
				zoom: 5.8,
			});

			map.addControl(
				new mapboxgl.default.NavigationControl({ showCompass: false }),
				"bottom-right",
			);
			map.on("load", () => setMapReady(true));
			mapInstanceRef.current = map;
		});

		return () => {
			cancelled = true;
			for (const marker of photoMarkersRef.current.values()) marker.remove();
			photoMarkersRef.current.clear();
			selectedMarkerRef.current?.remove();
			selectedMarkerRef.current = null;
			clusterHandlersAttachedRef.current = false;
			mapInstanceRef.current?.remove();
			mapInstanceRef.current = null;
			mapboxRef.current = null;
			setMapReady(false);
		};
	}, [token]);

	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map) return;

		map.resize();
		const resizeDelay = isFullscreen ? 360 : 220;
		const resizeTimeout = window.setTimeout(() => map.resize(), resizeDelay);
		return () => window.clearTimeout(resizeTimeout);
	}, [isFullscreen]);

	const refreshPhotoMarkers = useCallback(() => {
		const map = mapInstanceRef.current;
		const mapboxgl = mapboxRef.current;
		if (!map || !mapboxgl || !mapReady || !map.getSource(COMPANY_SOURCE_ID)) {
			return;
		}

		const visibleCompanyIds = new Set<string>();
		const features = map.querySourceFeatures(COMPANY_SOURCE_ID, {
			filter: ["!", ["has", "point_count"]],
		});

		for (const feature of features) {
			const companyId = feature.properties?.companyId;
			if (typeof companyId !== "string" || visibleCompanyIds.has(companyId)) {
				continue;
			}
			if (companyId === selectedCompanyId) {
				visibleCompanyIds.add(companyId);
				photoMarkersRef.current.get(companyId)?.remove();
				photoMarkersRef.current.delete(companyId);
				continue;
			}

			const company = companiesById.get(companyId);
			if (!company) continue;

			const coordinates = getCompanyCoordinates(company);
			if (!coordinates) continue;

			visibleCompanyIds.add(companyId);
			let marker = photoMarkersRef.current.get(companyId);
			if (!marker) {
				const element = createCompanyMarkerElement(
					company,
					companyId === selectedCompanyId,
				);
				element.addEventListener("click", () => {
					onCompanyClick(company);
					flyToCompany(company);
				});
				marker = new mapboxgl.Marker({ element }).setLngLat(coordinates);
				photoMarkersRef.current.set(companyId, marker);
			}

			setCompanyMarkerSelected(
				marker.getElement(),
				companyId === selectedCompanyId,
			);
			marker.setLngLat(coordinates).addTo(map);
		}

		for (const [companyId, marker] of photoMarkersRef.current) {
			if (!visibleCompanyIds.has(companyId)) {
				marker.remove();
				photoMarkersRef.current.delete(companyId);
			}
		}
	}, [
		companiesById,
		flyToCompany,
		mapReady,
		onCompanyClick,
		selectedCompanyId,
	]);

	useEffect(() => {
		refreshSelectedMarker();
	}, [refreshSelectedMarker]);

	useEffect(() => {
		const map = mapInstanceRef.current;
		const mapboxgl = mapboxRef.current;
		if (!map || !mapboxgl || !mapReady) return;

		selectedMarkerRef.current?.remove();
		selectedMarkerRef.current = null;

		if (!selectedCompany) return;
		const coordinates = getCompanyCoordinates(selectedCompany);
		if (!coordinates) return;

		const element = createCompanyMarkerElement(selectedCompany, true);
		element.addEventListener("click", () => onCompanyClick(selectedCompany));
		selectedMarkerRef.current = new mapboxgl.Marker({ element })
			.setLngLat(coordinates)
			.addTo(map);

		return () => {
			selectedMarkerRef.current?.remove();
			selectedMarkerRef.current = null;
		};
	}, [mapReady, onCompanyClick, selectedCompany]);

	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map || !mapReady) return;

		const existingSource = map.getSource(COMPANY_SOURCE_ID);
		if (existingSource) {
			(existingSource as GeoJSONSource).setData(companyFeatureCollection);
		} else {
			map.addSource(COMPANY_SOURCE_ID, {
				cluster: true,
				clusterMaxZoom: 14,
				clusterRadius: 48,
				data: companyFeatureCollection,
				type: "geojson",
			});
		}

		if (!map.getLayer(COMPANY_CLUSTERS_LAYER_ID)) {
			map.addLayer({
				filter: ["has", "point_count"],
				id: COMPANY_CLUSTERS_LAYER_ID,
				paint: {
					"circle-color": [
						"step",
						["get", "point_count"],
						"#059669",
						10,
						"#0f766e",
						30,
						"#0f172a",
					],
					"circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 30, 32],
					"circle-stroke-color": "#ffffff",
					"circle-stroke-width": 3,
				},
				source: COMPANY_SOURCE_ID,
				type: "circle",
			});
		}

		if (!map.getLayer(COMPANY_CLUSTER_COUNT_LAYER_ID)) {
			map.addLayer({
				filter: ["has", "point_count"],
				id: COMPANY_CLUSTER_COUNT_LAYER_ID,
				layout: {
					"text-field": ["get", "point_count_abbreviated"],
					"text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
					"text-size": 12,
				},
				paint: {
					"text-color": "#ffffff",
				},
				source: COMPANY_SOURCE_ID,
				type: "symbol",
			});
		}

		if (!clusterHandlersAttachedRef.current) {
			map.on("click", COMPANY_CLUSTERS_LAYER_ID, (event) => {
				const feature = map
					.queryRenderedFeatures(event.point, {
						layers: [COMPANY_CLUSTERS_LAYER_ID],
					})
					.at(0);
				if (!feature) return;

				const clusterId = feature.properties?.cluster_id;
				if (typeof clusterId !== "number") return;

				const source = map.getSource(COMPANY_SOURCE_ID) as GeoJSONSource;
				source.getClusterExpansionZoom(clusterId, (error, zoom) => {
					if (error || typeof zoom !== "number") return;
					const coordinates =
						feature.geometry.type === "Point"
							? feature.geometry.coordinates
							: null;
					if (!coordinates) return;
					const longitude = coordinates.at(0);
					const latitude = coordinates.at(1);
					if (typeof longitude !== "number" || typeof latitude !== "number") {
						return;
					}

					map.easeTo({ center: [longitude, latitude], duration: 650, zoom });
				});
			});

			map.on("mouseenter", COMPANY_CLUSTERS_LAYER_ID, () => {
				map.getCanvas().style.cursor = "pointer";
			});
			map.on("mouseleave", COMPANY_CLUSTERS_LAYER_ID, () => {
				map.getCanvas().style.cursor = "";
			});
			clusterHandlersAttachedRef.current = true;
		}

		map.once("idle", refreshPhotoMarkers);
	}, [companyFeatureCollection, mapReady, refreshPhotoMarkers]);

	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map || !mapReady) return;

		if (isPresentationMode) {
			map.setProjection("globe");
			map.easeTo({
				bearing: 0,
				center: [-111.891, 39.321],
				duration: 1200,
				essential: true,
				pitch: 0,
				zoom: 2.0,
			});
			return;
		}

		map.easeTo({
			bearing: 0,
			center: [-111.891, 39.321],
			duration: 800,
			essential: true,
			pitch: 0,
			zoom: 5.8,
		});
	}, [isPresentationMode, mapReady]);

	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map || !mapReady || !isPresentationMode) return;

		let previousTime: number | null = null;
		const degreesPerSecond = 0.9;

		function rotateMap(time: number) {
			if (!mapInstanceRef.current) return;
			if (previousTime !== null) {
				const elapsedSeconds = (time - previousTime) / 1000;
				const center = mapInstanceRef.current.getCenter();
				mapInstanceRef.current.setCenter([
					center.lng + elapsedSeconds * degreesPerSecond,
					center.lat,
				]);
			}

			previousTime = time;
			presentationFrameRef.current = window.requestAnimationFrame(rotateMap);
		}

		const spinStartTimeout = window.setTimeout(() => {
			presentationFrameRef.current = window.requestAnimationFrame(rotateMap);
		}, 1300);

		return () => {
			window.clearTimeout(spinStartTimeout);
			if (presentationFrameRef.current !== null) {
				window.cancelAnimationFrame(presentationFrameRef.current);
				presentationFrameRef.current = null;
			}
		};
	}, [isPresentationMode, mapReady]);

	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map || !mapReady || !isPresentationMode) return;

		const destinations = shuffleDestinations(FLIGHT_DESTINATIONS);
		const arcs = destinations.map((dest) =>
			computeFlightArc(UTAH_ORIGIN, dest),
		);
		const startInterval = FLIGHT_CYCLE_MS / destinations.length;

		map.addSource(FLIGHT_SOURCE_ID, {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});
		map.addLayer({
			id: FLIGHT_GLOW_LAYER_ID,
			type: "line",
			source: FLIGHT_SOURCE_ID,
			paint: {
				"line-color": "#10b981",
				"line-width": 6,
				"line-opacity": ["*", ["get", "opacity"], 0.22],
				"line-blur": 3,
			},
			layout: { "line-cap": "round", "line-join": "round" },
		});
		map.addLayer({
			id: FLIGHT_LINE_LAYER_ID,
			type: "line",
			source: FLIGHT_SOURCE_ID,
			paint: {
				"line-color": "#34d399",
				"line-width": 1.5,
				"line-opacity": ["get", "opacity"],
			},
			layout: { "line-cap": "round", "line-join": "round" },
		});

		const cycleStart = performance.now();

		function tick() {
			const m = mapInstanceRef.current;
			if (!m) return;
			const cycleTime = (performance.now() - cycleStart) % FLIGHT_CYCLE_MS;
			const features: GeoJSON.Feature<
				GeoJSON.LineString,
				{ opacity: number }
			>[] = [];

			for (let i = 0; i < destinations.length; i++) {
				const lineStart = i * startInterval;
				const lineTime = cycleTime - lineStart;
				if (lineTime <= 0 || lineTime > FLIGHT_TOTAL_MS) continue;

				let drawProgress: number;
				let opacity: number;

				if (lineTime <= FLIGHT_DRAW_MS) {
					const t = lineTime / FLIGHT_DRAW_MS;
					drawProgress = t * t * (3 - 2 * t); // smoothstep
					opacity = 1;
				} else if (lineTime <= FLIGHT_DRAW_MS + FLIGHT_HOLD_MS) {
					drawProgress = 1;
					opacity = 1;
				} else {
					drawProgress = 1;
					opacity =
						1 - (lineTime - FLIGHT_DRAW_MS - FLIGHT_HOLD_MS) / FLIGHT_FADE_MS;
				}

				const arc = arcs[i];
				if (!arc || arc.length < 2) continue;
				const pointCount = Math.max(2, Math.ceil(arc.length * drawProgress));
				features.push({
					type: "Feature",
					properties: { opacity: Math.max(0, opacity) },
					geometry: {
						type: "LineString",
						coordinates: arc.slice(0, pointCount),
					},
				});
			}

			const src = m.getSource(FLIGHT_SOURCE_ID);
			if (src) {
				(src as GeoJSONSource).setData({
					type: "FeatureCollection",
					features,
				});
			}

			flightFrameRef.current = window.requestAnimationFrame(tick);
		}

		flightFrameRef.current = window.requestAnimationFrame(tick);

		return () => {
			if (flightFrameRef.current !== null) {
				window.cancelAnimationFrame(flightFrameRef.current);
				flightFrameRef.current = null;
			}
			const m = mapInstanceRef.current;
			if (!m) return;
			if (m.getLayer(FLIGHT_LINE_LAYER_ID)) m.removeLayer(FLIGHT_LINE_LAYER_ID);
			if (m.getLayer(FLIGHT_GLOW_LAYER_ID)) m.removeLayer(FLIGHT_GLOW_LAYER_ID);
			if (m.getSource(FLIGHT_SOURCE_ID)) m.removeSource(FLIGHT_SOURCE_ID);
		};
	}, [isPresentationMode, mapReady]);

	useEffect(() => {
		const map = mapInstanceRef.current;
		if (!map || !mapReady) return;

		map.on("render", refreshPhotoMarkers);
		return () => {
			map.off("render", refreshPhotoMarkers);
		};
	}, [mapReady, refreshPhotoMarkers]);

	return { flyToCompany, mapRef };
}
