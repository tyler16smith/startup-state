"use client";

import { useEffect, useRef } from "react";
import { Input } from "~/components/ui/input";

export type CompanyAddressSelection = {
	address?: string;
	city?: string;
	county?: string;
	state?: string;
	postalCode?: string;
	latitude?: string;
	longitude?: string;
};

type GoogleAddressComponent = {
	long_name: string;
	short_name: string;
	types: string[];
};

type GooglePlaceResult = {
	address_components?: GoogleAddressComponent[];
	formatted_address?: string;
	geometry?: {
		location?: {
			lat: () => number;
			lng: () => number;
		};
	};
};

type GoogleAutocomplete = {
	addListener: (
		eventName: "place_changed",
		handler: () => void,
	) => { remove: () => void };
	getPlace: () => GooglePlaceResult;
};

type GoogleMapsApi = {
	maps: {
		places: {
			Autocomplete: new (
				input: HTMLInputElement,
				options: {
					componentRestrictions: { country: string };
					fields: string[];
					types: string[];
				},
			) => GoogleAutocomplete;
		};
	};
};

declare global {
	interface Window {
		google?: GoogleMapsApi;
		googleMapsPlacesPromise?: Promise<GoogleMapsApi>;
	}
}

export function CompanyAddressAutocomplete({
	defaultValue,
	onAddressChange,
}: {
	defaultValue?: string;
	onAddressChange: (selection: CompanyAddressSelection) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
		if (!apiKey || !inputRef.current) return;

		let isMounted = true;
		let listener: { remove: () => void } | undefined;

		void loadGooglePlaces(apiKey)
			.then((google) => {
				if (!isMounted || !inputRef.current) return;
				const autocomplete = new google.maps.places.Autocomplete(
					inputRef.current,
					{
						componentRestrictions: { country: "us" },
						fields: ["address_components", "formatted_address", "geometry"],
						types: ["address"],
					},
				);
				listener = autocomplete.addListener("place_changed", () => {
					onAddressChange(parsePlace(autocomplete.getPlace()));
				});
			})
			.catch(() => undefined);

		return () => {
			isMounted = false;
			listener?.remove();
		};
	}, [onAddressChange]);

	return (
		<Input
			autoComplete="street-address"
			defaultValue={defaultValue}
			name="address"
			onChange={(event) =>
				onAddressChange({
					address: event.target.value,
					city: "",
					county: "",
					latitude: "",
					longitude: "",
					postalCode: "",
					state: "UT",
				})
			}
			placeholder="Start typing your company address"
			ref={inputRef}
		/>
	);
}

function loadGooglePlaces(apiKey: string) {
	if (window.google?.maps.places) return Promise.resolve(window.google);
	if (window.googleMapsPlacesPromise) return window.googleMapsPlacesPromise;

	window.googleMapsPlacesPromise = new Promise<GoogleMapsApi>(
		(resolve, reject) => {
			const script = document.createElement("script");
			script.async = true;
			script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
			script.onload = () => {
				if (window.google?.maps.places) resolve(window.google);
				else reject(new Error("Google Places failed to load"));
			};
			script.onerror = () => reject(new Error("Google Places failed to load"));
			document.head.appendChild(script);
		},
	);

	return window.googleMapsPlacesPromise;
}

function parsePlace(place: GooglePlaceResult): CompanyAddressSelection {
	const components = place.address_components ?? [];
	const location = place.geometry?.location;

	return {
		address: place.formatted_address,
		city:
			component(components, "locality") ??
			component(components, "postal_town") ??
			component(components, "administrative_area_level_3"),
		county: component(components, "administrative_area_level_2")?.replace(
			/ County$/,
			"",
		),
		state: component(components, "administrative_area_level_1", "short_name"),
		postalCode: component(components, "postal_code", "short_name"),
		latitude: location ? String(location.lat()) : undefined,
		longitude: location ? String(location.lng()) : undefined,
	};
}

function component(
	components: GoogleAddressComponent[],
	type: string,
	name: "long_name" | "short_name" = "long_name",
) {
	return components.find((item) => item.types.includes(type))?.[name];
}
