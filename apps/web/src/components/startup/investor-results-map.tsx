"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";
import type { InvestorCompanyRecommendation } from "~/lib/startup-api";

type InvestorResultsMapProps = {
	recommendations: InvestorCompanyRecommendation[];
	selectedCompanyId?: string;
	mapToken?: string;
};

export function InvestorResultsMap({
	recommendations,
	selectedCompanyId,
	mapToken,
}: InvestorResultsMapProps) {
	const mapRef = useRef<HTMLDivElement | null>(null);
	// biome-ignore lint/suspicious/noExplicitAny: mapbox-gl types loaded dynamically
	const mapInstanceRef = useRef<any>(null);
	// biome-ignore lint/suspicious/noExplicitAny: mapbox-gl marker type
	const markersRef = useRef<Map<string, any>>(new Map());

	useEffect(() => {
		if (!mapToken || !mapRef.current || mapInstanceRef.current) return;

		let cancelled = false;

		void import("mapbox-gl").then((mapboxgl) => {
			if (cancelled || !mapRef.current) return;

			mapboxgl.default.accessToken = mapToken;

			const map = new mapboxgl.default.Map({
				center: [-111.891, 39.321],
				container: mapRef.current,
				style: "mapbox://styles/mapbox/light-v11",
				zoom: 5.8,
			});

			map.addControl(
				new mapboxgl.default.NavigationControl({ showCompass: false }),
				"bottom-right",
			);

			map.on("load", () => {
				const coordList: [number, number][] = [];

				for (const rec of recommendations) {
					const { latitude, longitude } = rec.company;
					if (typeof latitude !== "number" || typeof longitude !== "number") {
						continue;
					}

					const el = document.createElement("div");
					el.style.cssText =
						"width:28px;height:28px;border-radius:50%;background:#059669;color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;cursor:default;";
					el.textContent = String(rec.rank);

					const marker = new mapboxgl.default.Marker({ element: el })
						.setLngLat([longitude, latitude])
						.addTo(map);

					markersRef.current.set(rec.company.id, marker);
					coordList.push([longitude, latitude]);
				}

				if (coordList.length > 0) {
					const first = coordList[0];
					if (first) {
						const bounds = coordList.reduce(
							(b, coord) => b.extend(coord),
							new mapboxgl.default.LngLatBounds(first, first),
						);
						map.fitBounds(bounds, { maxZoom: 10, padding: 80 });
					}
				}
			});

			mapInstanceRef.current = map;
		});

		return () => {
			cancelled = true;
			for (const marker of markersRef.current.values()) marker.remove();
			markersRef.current.clear();
			mapInstanceRef.current?.remove();
			mapInstanceRef.current = null;
		};
	}, [mapToken, recommendations]);

	useEffect(() => {
		if (!selectedCompanyId || !mapInstanceRef.current) return;
		const rec = recommendations.find((r) => r.company.id === selectedCompanyId);
		if (!rec) return;
		const { latitude, longitude } = rec.company;
		if (typeof latitude !== "number" || typeof longitude !== "number") return;

		mapInstanceRef.current.flyTo({
			center: [longitude, latitude],
			duration: 900,
			essential: true,
			zoom: 11,
		});
	}, [selectedCompanyId, recommendations]);

	if (!mapToken) {
		return (
			<div className="flex h-full items-center justify-center bg-slate-100 text-muted-foreground text-sm">
				Map unavailable
			</div>
		);
	}

	return <div className="h-full w-full" ref={mapRef} />;
}
