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
			if (!company || feature.geometry.type !== "Point") continue;

			const coordinates = feature.geometry.coordinates;
			const longitude = coordinates.at(0);
			const latitude = coordinates.at(1);
			if (typeof longitude !== "number" || typeof latitude !== "number") {
				continue;
			}

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
				marker = new mapboxgl.Marker({ element }).setLngLat([
					longitude,
					latitude,
				]);
				photoMarkersRef.current.set(companyId, marker);
			}

			setCompanyMarkerSelected(
				marker.getElement(),
				companyId === selectedCompanyId,
			);
			marker.setLngLat([longitude, latitude]).addTo(map);
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
		if (!map || !mapReady) return;

		map.on("render", refreshPhotoMarkers);
		return () => {
			map.off("render", refreshPhotoMarkers);
		};
	}, [mapReady, refreshPhotoMarkers]);

	return { flyToCompany, mapRef };
}
