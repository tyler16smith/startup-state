"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";
import type { InvestorCompanyRecommendation } from "~/lib/startup-api";

type InvestorResultsMapProps = {
	recommendations: InvestorCompanyRecommendation[];
	selectedCompanyId?: string;
	onCompanySelect?: (companyId: string) => void;
	mapToken?: string;
};

export function InvestorResultsMap({
	recommendations,
	selectedCompanyId,
	onCompanySelect,
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

					const el = document.createElement("button");
					el.type = "button";
					el.setAttribute("aria-label", `Focus ${rec.company.name}`);
					el.style.cssText =
						"width:28px;height:28px;border-radius:50%;background:#059669;color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;cursor:pointer;padding:0;outline:none;";
					el.textContent = String(rec.rank);
					el.addEventListener("click", () => onCompanySelect?.(rec.company.id));

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
						map.fitBounds(bounds, {
							maxZoom: 10,
							padding: { bottom: 80, left: 380, right: 80, top: 80 },
						});
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
	}, [mapToken, onCompanySelect, recommendations]);

	useEffect(() => {
		for (const [companyId, marker] of markersRef.current.entries()) {
			const element = marker.getElement() as HTMLElement;
			const isSelected = companyId === selectedCompanyId;
			element.style.background = isSelected ? "#047857" : "#059669";
			element.style.borderColor = isSelected ? "#a7f3d0" : "white";
			element.style.outline = isSelected
				? "3px solid rgba(16,185,129,0.35)"
				: "none";
			element.style.boxShadow = isSelected
				? "0 4px 12px rgba(4,120,87,0.45)"
				: "0 2px 6px rgba(0,0,0,0.3)";
		}
	}, [selectedCompanyId]);

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
			padding: { left: 320 },
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
