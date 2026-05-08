import { z } from "zod";
import { logger, normalizeError } from "~/lib/logger";

const CENSUS_GEOCODER_URL =
	"https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
const CENSUS_COORDINATES_URL =
	"https://geocoding.geo.census.gov/geocoder/geographies/coordinates";
const GOOGLE_GEOCODER_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const REQUEST_TIMEOUT_MS = 8000;
const GOOGLE_CONCURRENCY = 4;

export type LocationPrecision =
	| "rooftop"
	| "street"
	| "postal_code"
	| "city"
	| "state"
	| "unknown";

export type GeocodeProvider = "google" | "census" | "existing";

export type CompanyLocationInput = {
	address?: string | null;
	city?: string | null;
	county?: string | null;
	state?: string | null;
	postalCode?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	locationPrecision?: LocationPrecision | null;
	geocodeProvider?: GeocodeProvider | null;
};

export type GeocodedAddress = {
	address?: string;
	city?: string;
	county?: string;
	state?: string;
	postalCode?: string;
	latitude?: number;
	longitude?: number;
	locationPrecision?: LocationPrecision;
	provider?: GeocodeProvider;
};

type ProviderFailure = {
	provider: GeocodeProvider;
	query: string;
	status?: string;
	reason: string;
	errorMessage?: string;
};

type GeocodeAttempt = {
	result: GeocodedAddress | null;
	failure?: ProviderFailure;
};

type QueryGeocodeResult = {
	result: GeocodedAddress | null;
	googleMatched: boolean;
	censusCoordinateMatched: boolean;
	censusFallbackMatched: boolean;
	failures: ProviderFailure[];
};

const censusGeocodeSchema = z.object({
	result: z.object({
		addressMatches: z
			.array(
				z.object({
					matchedAddress: z.string().optional(),
					coordinates: z
						.object({
							x: z.number().optional(),
							y: z.number().optional(),
						})
						.optional(),
					addressComponents: z
						.object({
							city: z.string().optional(),
							state: z.string().optional(),
							zip: z.string().optional(),
						})
						.optional(),
					geographies: z
						.object({
							Counties: z
								.array(
									z.object({
										BASENAME: z.string().optional(),
										NAME: z.string().optional(),
									}),
								)
								.optional(),
						})
						.optional(),
				}),
			)
			.default([]),
	}),
});

const censusCoordinateSchema = z.object({
	result: z.object({
		geographies: z
			.object({
				Counties: z
					.array(
						z.object({
							BASENAME: z.string().optional(),
							NAME: z.string().optional(),
						}),
					)
					.optional(),
				States: z
					.array(
						z.object({
							STUSAB: z.string().optional(),
							NAME: z.string().optional(),
						}),
					)
					.optional(),
			})
			.passthrough()
			.optional(),
	}),
});

const googleGeocodeSchema = z.object({
	status: z.string(),
	error_message: z.string().optional(),
	results: z
		.array(
			z.object({
				formatted_address: z.string().optional(),
				types: z.array(z.string()).default([]),
				address_components: z
					.array(
						z.object({
							long_name: z.string(),
							short_name: z.string(),
							types: z.array(z.string()).default([]),
						}),
					)
					.default([]),
				geometry: z.object({
					location: z.object({
						lat: z.number(),
						lng: z.number(),
					}),
					location_type: z.string().optional(),
				}),
			}),
		)
		.default([]),
});

type GoogleResult = z.infer<typeof googleGeocodeSchema>["results"][number];

function cleanPart(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function normalizeForCompare(value: string): string {
	return value
		.toLowerCase()
		.replace(/\s+/g, " ")
		.replace(/[.,]+$/g, "")
		.trim();
}

function normalizeTitleCase(value: string | undefined): string | undefined {
	if (!value) return undefined;
	return value
		.toLowerCase()
		.split(/\s+/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function normalizeCounty(value: string | undefined): string | undefined {
	return normalizeTitleCase(value?.replace(/\s+County$/i, ""));
}

function normalizeState(value: string | undefined): string | undefined {
	return value?.trim().toUpperCase();
}

function hasCoordinates(input: CompanyLocationInput) {
	return (
		input.latitude !== undefined &&
		input.latitude !== null &&
		input.longitude !== undefined &&
		input.longitude !== null
	);
}

function hasCompleteLocation(input: CompanyLocationInput) {
	return Boolean(
		input.city &&
			input.county &&
			input.state &&
			input.postalCode &&
			hasCoordinates(input),
	);
}

function addressLooksCityOnly(address: string) {
	return !/\d/.test(address) && !address.includes(",");
}

export function buildLocationQuery(
	company: CompanyLocationInput,
): string | null {
	const address = cleanPart(company.address);
	const city = cleanPart(company.city);
	let state = normalizeState(cleanPart(company.state));
	const postalCode = cleanPart(company.postalCode);

	if (!address && !city) return null;

	if (!state && (city || (address && addressLooksCityOnly(address)))) {
		state = "UT";
	}

	const addressSegments = address
		? new Set(address.split(",").map((part) => normalizeForCompare(part)))
		: new Set<string>();
	const parts: string[] = [];

	function includesPart(part: string) {
		const normalized = normalizeForCompare(part);
		return (
			parts.some((existing) => normalizeForCompare(existing) === normalized) ||
			addressSegments.has(normalized)
		);
	}

	if (address) parts.push(address);
	if (city && !includesPart(city)) parts.push(city);
	if (state && !includesPart(state)) parts.push(state);
	if (postalCode && !includesPart(postalCode)) parts.push(postalCode);

	return parts.join(", ");
}

function getGoogleComponent(
	components: GoogleResult["address_components"],
	type: string,
) {
	return components.find((component) => component.types.includes(type));
}

function getGoogleCity(components: GoogleResult["address_components"]) {
	return (
		getGoogleComponent(components, "locality")?.long_name ??
		getGoogleComponent(components, "postal_town")?.long_name ??
		getGoogleComponent(components, "administrative_area_level_3")?.long_name ??
		getGoogleComponent(components, "administrative_area_level_2")?.long_name
	);
}

function mapGooglePrecision(result: GoogleResult): LocationPrecision {
	if (result.geometry.location_type === "ROOFTOP") return "rooftop";
	if (result.geometry.location_type === "RANGE_INTERPOLATED") return "street";
	if (result.types.includes("postal_code")) return "postal_code";
	if (result.types.includes("locality")) return "city";
	if (result.types.includes("administrative_area_level_1")) return "state";
	return "unknown";
}

function parseGoogleResult(result: GoogleResult): GeocodedAddress {
	const city = getGoogleCity(result.address_components);
	const county = getGoogleComponent(
		result.address_components,
		"administrative_area_level_2",
	);
	const state = getGoogleComponent(
		result.address_components,
		"administrative_area_level_1",
	);
	const postalCode = getGoogleComponent(
		result.address_components,
		"postal_code",
	);

	return {
		address: result.formatted_address,
		city: normalizeTitleCase(city),
		county: normalizeCounty(county?.long_name),
		state: normalizeState(state?.short_name),
		postalCode: postalCode?.long_name,
		latitude: result.geometry.location.lat,
		longitude: result.geometry.location.lng,
		locationPrecision: mapGooglePrecision(result),
		provider: "google",
	};
}

async function fetchJsonWithTimeout(url: URL) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) {
			return {
				ok: false as const,
				status: String(response.status),
				errorMessage: response.statusText,
			};
		}
		return { ok: true as const, body: await response.json() };
	} catch (error) {
		return { ok: false as const, ...normalizeError(error) };
	} finally {
		clearTimeout(timeout);
	}
}

async function tryGoogleGeocode(query: string): Promise<GeocodeAttempt> {
	const apiKey = process.env.GOOGLE_MAPS_API_KEY;
	if (!apiKey) {
		return {
			result: null,
			failure: {
				provider: "google",
				query,
				reason: "missing_api_key",
			},
		};
	}

	const url = new URL(GOOGLE_GEOCODER_URL);
	url.searchParams.set("address", query);
	url.searchParams.set("components", "country:US|administrative_area:UT");
	url.searchParams.set("key", apiKey);

	const response = await fetchJsonWithTimeout(url);
	if (!response.ok) {
		return {
			result: null,
			failure: {
				provider: "google",
				query,
				status: response.status,
				reason: "request_failed",
				errorMessage: response.errorMessage,
			},
		};
	}

	const parsed = googleGeocodeSchema.safeParse(response.body);
	if (!parsed.success) {
		return {
			result: null,
			failure: {
				provider: "google",
				query,
				reason: "invalid_response",
				errorMessage: parsed.error.message,
			},
		};
	}

	if (parsed.data.status !== "OK") {
		return {
			result: null,
			failure: {
				provider: "google",
				query,
				status: parsed.data.status,
				reason: "provider_status",
				errorMessage: parsed.data.error_message,
			},
		};
	}

	const result = parsed.data.results.at(0);
	if (!result) {
		return {
			result: null,
			failure: {
				provider: "google",
				query,
				status: parsed.data.status,
				reason: "no_results",
			},
		};
	}

	return { result: parseGoogleResult(result) };
}

export async function fetchGoogleGeocode(
	query: string,
): Promise<GeocodedAddress | null> {
	return (await tryGoogleGeocode(query)).result;
}

export async function fetchCensusGeographiesByCoordinates(input: {
	latitude: number;
	longitude: number;
}): Promise<Partial<GeocodedAddress> | null> {
	const url = new URL(CENSUS_COORDINATES_URL);
	url.searchParams.set("x", String(input.longitude));
	url.searchParams.set("y", String(input.latitude));
	url.searchParams.set("benchmark", "Public_AR_Current");
	url.searchParams.set("vintage", "Current_Current");
	url.searchParams.set("format", "json");

	const response = await fetchJsonWithTimeout(url);
	if (!response.ok) return null;

	const parsed = censusCoordinateSchema.safeParse(response.body);
	if (!parsed.success) return null;

	const county = parsed.data.result.geographies?.Counties?.at(0);
	const state = parsed.data.result.geographies?.States?.at(0);
	const geographies: Partial<GeocodedAddress> = {
		county: normalizeCounty(county?.BASENAME ?? county?.NAME),
		state: normalizeState(state?.STUSAB),
		provider: "census",
	};

	if (!geographies.county && !geographies.state) return null;
	return geographies;
}

async function tryCensusGeocode(address: string): Promise<GeocodeAttempt> {
	const url = new URL(CENSUS_GEOCODER_URL);
	url.searchParams.set("address", address);
	url.searchParams.set("benchmark", "Public_AR_Current");
	url.searchParams.set("vintage", "Current_Current");
	url.searchParams.set("format", "json");

	const response = await fetchJsonWithTimeout(url);
	if (!response.ok) {
		return {
			result: null,
			failure: {
				provider: "census",
				query: address,
				status: response.status,
				reason: "request_failed",
				errorMessage: response.errorMessage,
			},
		};
	}

	const parsed = censusGeocodeSchema.safeParse(response.body);
	if (!parsed.success) {
		return {
			result: null,
			failure: {
				provider: "census",
				query: address,
				reason: "invalid_response",
				errorMessage: parsed.error.message,
			},
		};
	}

	const match = parsed.data.result.addressMatches.at(0);
	if (!match) {
		return {
			result: null,
			failure: {
				provider: "census",
				query: address,
				reason: "no_results",
			},
		};
	}

	return {
		result: {
			address: match.matchedAddress,
			city: normalizeTitleCase(match.addressComponents?.city),
			county: normalizeCounty(
				match.geographies?.Counties?.at(0)?.BASENAME ??
					match.geographies?.Counties?.at(0)?.NAME,
			),
			state: normalizeState(match.addressComponents?.state),
			postalCode: match.addressComponents?.zip,
			latitude: match.coordinates?.y,
			longitude: match.coordinates?.x,
			locationPrecision:
				match.coordinates?.x !== undefined && match.coordinates?.y !== undefined
					? "street"
					: "unknown",
			provider: "census",
		},
	};
}

export async function fetchCensusGeocode(
	address: string,
): Promise<GeocodedAddress | null> {
	return (await tryCensusGeocode(address)).result;
}

async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	mapper: (item: T) => Promise<R>,
) {
	const results: R[] = [];
	const queue = items.map((item, index) => ({ index, item }));
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < queue.length) {
			const entry = queue[nextIndex];
			nextIndex += 1;
			if (!entry) continue;
			results[entry.index] = await mapper(entry.item);
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, () => worker()),
	);

	return results;
}

function precisionRank(precision: LocationPrecision | null | undefined) {
	switch (precision) {
		case "rooftop":
			return 5;
		case "street":
			return 4;
		case "postal_code":
			return 3;
		case "city":
			return 2;
		case "state":
			return 1;
		default:
			return 0;
	}
}

function shouldUpdatePrecision(
	current: LocationPrecision | null | undefined,
	next: LocationPrecision | undefined,
) {
	return Boolean(next && precisionRank(next) >= precisionRank(current));
}

function mergeGeocodedAddress<T extends CompanyLocationInput>(
	company: T,
	geocoded: GeocodedAddress,
): T {
	return {
		...company,
		address: geocoded.address ?? company.address,
		city: geocoded.city ?? company.city,
		county: geocoded.county ?? company.county,
		state: geocoded.state ?? company.state,
		postalCode: geocoded.postalCode ?? company.postalCode,
		latitude: company.latitude ?? geocoded.latitude,
		longitude: company.longitude ?? geocoded.longitude,
		locationPrecision: shouldUpdatePrecision(
			company.locationPrecision,
			geocoded.locationPrecision,
		)
			? geocoded.locationPrecision
			: company.locationPrecision,
		geocodeProvider: geocoded.provider ?? company.geocodeProvider,
	};
}

function mergeCoordinateGeographies<T extends CompanyLocationInput>(
	company: T,
	geographies: Partial<GeocodedAddress>,
): T {
	return {
		...company,
		city: company.city ?? geographies.city,
		county: geographies.county ?? company.county,
		state: company.state ?? geographies.state,
		postalCode: company.postalCode ?? geographies.postalCode,
		geocodeProvider: company.geocodeProvider ?? geographies.provider,
	};
}

function hasGeographyValue(geographies: Partial<GeocodedAddress> | null) {
	return Boolean(
		geographies?.city ||
			geographies?.county ||
			geographies?.state ||
			geographies?.postalCode,
	);
}

async function geocodeQuery(query: string): Promise<QueryGeocodeResult> {
	const failures: ProviderFailure[] = [];
	const google = await tryGoogleGeocode(query);
	if (google.failure) failures.push(google.failure);

	if (google.result) {
		let result = google.result;
		let censusCoordinateMatched = false;
		if (result.latitude !== undefined && result.longitude !== undefined) {
			const censusGeographies = await fetchCensusGeographiesByCoordinates({
				latitude: result.latitude,
				longitude: result.longitude,
			});
			if (hasGeographyValue(censusGeographies)) {
				censusCoordinateMatched = true;
				result = {
					...result,
					county: censusGeographies?.county ?? result.county,
					state: censusGeographies?.state ?? result.state,
				};
			}
		}

		return {
			result,
			googleMatched: true,
			censusCoordinateMatched,
			censusFallbackMatched: false,
			failures,
		};
	}

	const census = await tryCensusGeocode(query);
	if (census.failure) failures.push(census.failure);

	return {
		result: census.result,
		googleMatched: false,
		censusCoordinateMatched: false,
		censusFallbackMatched: Boolean(census.result),
		failures,
	};
}

function coordinateKey(company: CompanyLocationInput) {
	return `${company.latitude},${company.longitude}`;
}

export async function enrichCompanyLocations<T extends CompanyLocationInput>(
	companies: T[],
): Promise<T[]> {
	const incompleteCompanies = companies.filter(
		(company) => !hasCompleteLocation(company),
	);
	const coordinateInputs = Array.from(
		new Set(
			incompleteCompanies
				.filter((company) => hasCoordinates(company))
				.map((company) => coordinateKey(company)),
		),
	);
	const queries = Array.from(
		new Set(
			incompleteCompanies
				.filter((company) => !hasCoordinates(company))
				.map((company) => buildLocationQuery(company))
				.filter((query): query is string => Boolean(query)),
		),
	);

	if (coordinateInputs.length === 0 && queries.length === 0) return companies;

	const coordinateResults = await mapWithConcurrency(
		coordinateInputs,
		GOOGLE_CONCURRENCY,
		async (coordinates) => {
			const [latitudeValue, longitudeValue] = coordinates.split(",");
			const latitude = Number(latitudeValue);
			const longitude = Number(longitudeValue);
			return [
				coordinates,
				Number.isFinite(latitude) && Number.isFinite(longitude)
					? await fetchCensusGeographiesByCoordinates({ latitude, longitude })
					: null,
			] as const;
		},
	);
	const coordinatesByKey = new Map(coordinateResults);

	const geocodedResults = await mapWithConcurrency(
		queries,
		GOOGLE_CONCURRENCY,
		async (query) => [query, await geocodeQuery(query)] as const,
	);
	const geocodedByQuery = new Map(geocodedResults);

	const enriched = companies.map((company) => {
		if (hasCompleteLocation(company)) return company;

		if (hasCoordinates(company)) {
			const geographies = coordinatesByKey.get(coordinateKey(company));
			return geographies
				? mergeCoordinateGeographies(company, geographies)
				: company;
		}

		const query = buildLocationQuery(company);
		const geocoded = query ? geocodedByQuery.get(query)?.result : null;
		return geocoded ? mergeGeocodedAddress(company, geocoded) : company;
	});

	const googleMatched = geocodedResults.filter(
		([, result]) => result.googleMatched,
	).length;
	const censusFallbackMatched = geocodedResults.filter(
		([, result]) => result.censusFallbackMatched,
	).length;
	const censusCoordinateEnriched =
		coordinateResults.filter(([, result]) => hasGeographyValue(result)).length +
		geocodedResults.filter(([, result]) => result.censusCoordinateMatched)
			.length;
	const missedQueries = geocodedResults
		.filter(([, result]) => !result.result)
		.map(([query, result]) => ({
			query,
			failures: result.failures.map((failure) => ({
				provider: failure.provider,
				status: failure.status,
				reason: failure.reason,
				errorMessage: failure.errorMessage,
			})),
		}))
		.slice(0, 20);
	const providerFailures = geocodedResults
		.flatMap(([, result]) => result.failures)
		.map((failure) => ({
			provider: failure.provider,
			query: failure.query,
			status: failure.status,
			reason: failure.reason,
			errorMessage: failure.errorMessage,
		}))
		.slice(0, 20);
	const skippedNoQuery = incompleteCompanies.filter(
		(company) => !hasCoordinates(company) && !buildLocationQuery(company),
	).length;
	const missCount = geocodedResults.filter(
		([, result]) => !result.result,
	).length;
	const logContext = {
		feature: "startup-navigator",
		operation: "importCompanies",
		requested: queries.length + coordinateInputs.length,
		skippedNoQuery,
		googleMatched,
		censusCoordinateEnriched,
		censusFallbackMatched,
		missCount,
		missedQueries,
		providerFailures,
	};

	if (missCount > 0 || providerFailures.length > 0) {
		logger.warn(
			"Company CSV geocoding completed with provider misses",
			logContext,
		);
	} else {
		logger.info("Company CSV geocoding completed", logContext);
	}

	return enriched;
}
