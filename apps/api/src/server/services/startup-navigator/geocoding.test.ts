import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { CompanyLocationInput } from "./geocoding";
import {
	buildLocationQuery,
	enrichCompanyLocations,
	fetchCensusGeographiesByCoordinates,
	fetchGoogleGeocode,
} from "./geocoding";

const originalFetch = globalThis.fetch;
const originalGoogleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

type MockFetch = (url: URL) => unknown;
type TestCompanyLocation = CompanyLocationInput & { name?: string };

function restoreEnv() {
	if (originalGoogleMapsApiKey === undefined) {
		delete process.env.GOOGLE_MAPS_API_KEY;
	} else {
		process.env.GOOGLE_MAPS_API_KEY = originalGoogleMapsApiKey;
	}
}

function installFetchMock(handler: MockFetch) {
	const requests: URL[] = [];
	globalThis.fetch = async (input) => {
		const url = new URL(input.toString());
		requests.push(url);
		return new Response(JSON.stringify(handler(url)), {
			headers: { "content-type": "application/json" },
		});
	};
	return requests;
}

function googleComponent(longName: string, shortName: string, types: string[]) {
	return { long_name: longName, short_name: shortName, types };
}

function googleResponse(input: {
	formattedAddress: string;
	city?: string;
	county?: string;
	postalCode?: string;
	lat?: number;
	lng?: number;
	locationType?: string;
	types?: string[];
}) {
	const city = input.city ?? "Lehi";
	const components = [
		googleComponent(city, city, ["locality", "political"]),
		googleComponent(
			input.county ?? "Utah County",
			input.county ?? "Utah County",
			["administrative_area_level_2", "political"],
		),
		googleComponent("Utah", "UT", ["administrative_area_level_1", "political"]),
		googleComponent("United States", "US", ["country", "political"]),
	];
	if (input.postalCode) {
		components.push(
			googleComponent(input.postalCode, input.postalCode, ["postal_code"]),
		);
	}

	return {
		status: "OK",
		results: [
			{
				formatted_address: input.formattedAddress,
				types: input.types ?? ["street_address"],
				address_components: components,
				geometry: {
					location: {
						lat: input.lat ?? 40.4,
						lng: input.lng ?? -111.8,
					},
					location_type: input.locationType ?? "ROOFTOP",
				},
			},
		],
	};
}

function censusCoordinateResponse(county = "Salt Lake", state = "UT") {
	return {
		result: {
			geographies: {
				Counties: [{ BASENAME: county, NAME: `${county} County` }],
				States: [{ STUSAB: state, NAME: "Utah" }],
			},
		},
	};
}

function censusAddressResponse(input: {
	matchedAddress?: string;
	city?: string;
	county?: string;
	postalCode?: string;
	lat?: number;
	lng?: number;
}) {
	return {
		result: {
			addressMatches: [
				{
					matchedAddress:
						input.matchedAddress ?? "1355 S 960 E, Heber City, UT, 84032",
					coordinates: { x: input.lng ?? -111.41, y: input.lat ?? 40.5 },
					addressComponents: {
						city: input.city ?? "HEBER CITY",
						state: "UT",
						zip: input.postalCode ?? "84032",
					},
					geographies: {
						Counties: [
							{
								BASENAME: input.county ?? "Wasatch",
								NAME: `${input.county ?? "Wasatch"} County`,
							},
						],
					},
				},
			],
		},
	};
}

function responseForPromptInput(query: string) {
	const city = query.includes("Heber City")
		? "Heber City"
		: query.includes("Midvale")
			? "Midvale"
			: query.includes("Salt Lake City")
				? "Salt Lake City"
				: query.includes("Pleasant Grove")
					? "Pleasant Grove"
					: query.includes("Draper")
						? "Draper"
						: query.includes("Provo")
							? "Provo"
							: "Lehi";
	const cityOnly = query === "Midvale, UT" || query === "Salt Lake City, UT";
	return googleResponse({
		formattedAddress: cityOnly ? `${city}, UT, USA` : `${query}, USA`,
		city,
		county:
			city === "Salt Lake City" || city === "Midvale" || city === "Draper"
				? "Salt Lake County"
				: city === "Heber City"
					? "Wasatch County"
					: "Utah County",
		postalCode: cityOnly ? undefined : "84043",
		lat: cityOnly ? 40.61 : 40.42,
		lng: cityOnly ? -111.89 : -111.86,
		locationType: cityOnly ? "APPROXIMATE" : "ROOFTOP",
		types: cityOnly ? ["locality", "political"] : ["street_address"],
	});
}

afterEach(() => {
	globalThis.fetch = originalFetch;
	restoreEnv();
});

describe("buildLocationQuery", () => {
	it("joins location fields without obvious duplicates", () => {
		assert.equal(
			buildLocationQuery({
				address: "1557 West Innovation Way, Lehi, UT",
				state: "UT",
			}),
			"1557 West Innovation Way, Lehi, UT",
		);
		assert.equal(
			buildLocationQuery({ city: "Midvale", state: "UT" }),
			"Midvale, UT",
		);
		assert.equal(
			buildLocationQuery({ address: "Salt Lake City, UT" }),
			"Salt Lake City, UT",
		);
		assert.equal(
			buildLocationQuery({ city: "Salt Lake City" }),
			"Salt Lake City, UT",
		);
	});

	it("skips records without address or city", () => {
		assert.equal(buildLocationQuery({ address: null, city: null }), null);
		assert.equal(
			buildLocationQuery({ state: "UT", postalCode: "84043" }),
			null,
		);
	});
});

describe("Google geocoding", () => {
	it("parses address components and sends Utah component restrictions", async () => {
		process.env.GOOGLE_MAPS_API_KEY = "test-key";
		const requests = installFetchMock((url) => {
			assert.equal(
				url.searchParams.get("components"),
				"country:US|administrative_area:UT",
			);
			return googleResponse({
				formattedAddress: "1557 W Innovation Way, Lehi, UT 84043, USA",
				city: "LEHI",
				county: "Utah County",
				postalCode: "84043",
			});
		});

		const result = await fetchGoogleGeocode(
			"1557 West Innovation Way, Lehi, UT",
		);

		assert.equal(requests.length, 1);
		assert.equal(result?.address, "1557 W Innovation Way, Lehi, UT 84043, USA");
		assert.equal(result?.city, "Lehi");
		assert.equal(result?.county, "Utah");
		assert.equal(result?.state, "UT");
		assert.equal(result?.postalCode, "84043");
		assert.equal(result?.locationPrecision, "rooftop");
		assert.equal(result?.provider, "google");
		assert.equal(typeof result?.latitude, "number");
		assert.equal(typeof result?.longitude, "number");
	});

	it("maps Google result precision types", async () => {
		process.env.GOOGLE_MAPS_API_KEY = "test-key";
		const responses = [
			googleResponse({
				formattedAddress: "Range Interpolated",
				locationType: "RANGE_INTERPOLATED",
			}),
			googleResponse({
				formattedAddress: "84043, UT, USA",
				locationType: "APPROXIMATE",
				types: ["postal_code"],
			}),
			googleResponse({
				formattedAddress: "Midvale, UT, USA",
				city: "Midvale",
				locationType: "APPROXIMATE",
				types: ["locality", "political"],
			}),
			googleResponse({
				formattedAddress: "Utah, USA",
				city: "Utah",
				locationType: "APPROXIMATE",
				types: ["administrative_area_level_1", "political"],
			}),
		];
		installFetchMock(() => {
			const response = responses.shift();
			assert.ok(response);
			return response;
		});

		assert.equal(
			(await fetchGoogleGeocode("street"))?.locationPrecision,
			"street",
		);
		assert.equal(
			(await fetchGoogleGeocode("postal"))?.locationPrecision,
			"postal_code",
		);
		assert.equal((await fetchGoogleGeocode("city"))?.locationPrecision, "city");
		assert.equal(
			(await fetchGoogleGeocode("state"))?.locationPrecision,
			"state",
		);
	});

	it("returns non-null Utah results for known import inputs", async () => {
		process.env.GOOGLE_MAPS_API_KEY = "test-key";
		installFetchMock((url) =>
			responseForPromptInput(url.searchParams.get("address") ?? ""),
		);
		const testInputs = [
			"1557 West Innovation Way, Lehi, UT",
			"1355 South 960 East, Heber City, UT",
			"3450 Triumph Boulevard, Lehi, UT",
			"Midvale, UT",
			"Salt Lake City, UT",
			"Salt Lake City",
			"374 South 671 West, Pleasant Grove, UT",
			"15 West Scenic Point Drive, Draper, UT",
			"1441 West Innovation Way, Lehi, UT",
			"3049 Executive Parkway, Lehi, UT",
			"3715 Tracy Hall Parkway, Provo, UT",
		];

		for (const input of testInputs) {
			const result = await fetchGoogleGeocode(
				buildLocationQuery({ address: input }) ?? input,
			);
			assert.notEqual(result, null);
			assert.equal(typeof result?.latitude, "number");
			assert.equal(typeof result?.longitude, "number");
			assert.equal(result?.state, "UT");
			assert.ok(result?.city);
			if (input === "Midvale, UT" || input.startsWith("Salt Lake City")) {
				assert.equal(result?.locationPrecision, "city");
			}
		}
	});
});

describe("Census coordinate geographies", () => {
	it("returns normalized county and state", async () => {
		installFetchMock((url) => {
			assert.equal(url.searchParams.get("x"), "-111.89");
			assert.equal(url.searchParams.get("y"), "40.61");
			return censusCoordinateResponse("Salt Lake", "UT");
		});

		const result = await fetchCensusGeographiesByCoordinates({
			latitude: 40.61,
			longitude: -111.89,
		});

		assert.equal(result?.county, "Salt Lake");
		assert.equal(result?.state, "UT");
		assert.equal(result?.provider, "census");
	});
});

describe("enrichCompanyLocations", () => {
	it("uses Google first and prefers Census county from returned coordinates", async () => {
		process.env.GOOGLE_MAPS_API_KEY = "test-key";
		installFetchMock((url) => {
			if (url.pathname.includes("/geocode/json")) {
				return googleResponse({
					formattedAddress: "1557 W Innovation Way, Lehi, UT 84043, USA",
					city: "Lehi",
					county: "Utah County",
					postalCode: "84043",
				});
			}
			return censusCoordinateResponse("Salt Lake", "UT");
		});

		const [company] = await enrichCompanyLocations<TestCompanyLocation>([
			{ name: "Acme", address: "1557 West Innovation Way, Lehi, UT" },
		]);

		assert.equal(
			company?.address,
			"1557 W Innovation Way, Lehi, UT 84043, USA",
		);
		assert.equal(company?.city, "Lehi");
		assert.equal(company?.county, "Salt Lake");
		assert.equal(company?.state, "UT");
		assert.equal(company?.postalCode, "84043");
		assert.equal(company?.locationPrecision, "rooftop");
		assert.equal(company?.geocodeProvider, "google");
		assert.equal(typeof company?.latitude, "number");
		assert.equal(typeof company?.longitude, "number");
	});

	it("falls back to Census one-line geocoding when Google fails", async () => {
		process.env.GOOGLE_MAPS_API_KEY = "test-key";
		installFetchMock((url) => {
			if (url.pathname.includes("/geocode/json")) {
				return { status: "ZERO_RESULTS", results: [] };
			}
			return censusAddressResponse({ city: "HEBER CITY", county: "Wasatch" });
		});

		const [company] = await enrichCompanyLocations<TestCompanyLocation>([
			{ address: "1355 South 960 East, Heber City, UT" },
		]);

		assert.equal(company?.city, "Heber City");
		assert.equal(company?.county, "Wasatch");
		assert.equal(company?.state, "UT");
		assert.equal(company?.locationPrecision, "street");
		assert.equal(company?.geocodeProvider, "census");
		assert.equal(typeof company?.latitude, "number");
		assert.equal(typeof company?.longitude, "number");
	});

	it("enriches rows that already have coordinates with Census geography", async () => {
		const requests = installFetchMock(() =>
			censusCoordinateResponse("Salt Lake", "UT"),
		);

		const [company] = await enrichCompanyLocations<TestCompanyLocation>([
			{ latitude: 40.61, longitude: -111.89 },
		]);

		assert.equal(requests.length, 1);
		assert.equal(company?.county, "Salt Lake");
		assert.equal(company?.state, "UT");
		assert.equal(company?.latitude, 40.61);
		assert.equal(company?.longitude, -111.89);
		assert.equal(company?.geocodeProvider, "census");
	});

	it("keeps complete rows and rows without address or city unchanged", async () => {
		const requests = installFetchMock(() => {
			throw new Error("fetch should not be called");
		});
		const complete: TestCompanyLocation = {
			address: "1557 West Innovation Way",
			city: "Lehi",
			county: "Utah",
			state: "UT",
			postalCode: "84043",
			latitude: 40.4,
			longitude: -111.8,
			locationPrecision: "rooftop" as const,
			geocodeProvider: "existing" as const,
		};
		const empty: TestCompanyLocation = { state: "UT" };

		const result = await enrichCompanyLocations<TestCompanyLocation>([
			complete,
			empty,
		]);

		assert.equal(requests.length, 0);
		assert.deepEqual(result, [complete, empty]);
	});

	it("marks city-only Google matches as city precision", async () => {
		process.env.GOOGLE_MAPS_API_KEY = "test-key";
		installFetchMock((url) => {
			if (url.pathname.includes("/geocode/json")) {
				return responseForPromptInput(url.searchParams.get("address") ?? "");
			}
			return censusCoordinateResponse("Salt Lake", "UT");
		});

		const [company] = await enrichCompanyLocations<TestCompanyLocation>([
			{ city: "Midvale" },
		]);

		assert.equal(company?.city, "Midvale");
		assert.equal(company?.state, "UT");
		assert.equal(company?.locationPrecision, "city");
		assert.equal(company?.geocodeProvider, "google");
		assert.equal(typeof company?.latitude, "number");
		assert.equal(typeof company?.longitude, "number");
	});
});
