import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import Papa from "papaparse";

type Candidate = {
	url: string;
	source: string;
	score: number;
	notes: string[];
};

type LogoResult = {
	domain: string;
	homepageUrl: string;
	logoUrl: string;
	source: string;
	score: number | undefined;
	notes: string;
	error: string;
	candidates: Candidate[];
};

type CliOptions = {
	domain: string | undefined;
	inputPath: string | undefined;
	outputPath: string | undefined;
	concurrency: number;
	maxCandidates: number;
};

const DOMAIN_COLUMNS = [
	"domain",
	"website",
	"website_url",
	"websiteurl",
	"url",
	"link",
];
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_CANDIDATES = 10;
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT =
	"Mozilla/5.0 logo-discovery-script/1.0 (+https://startup-state.local)";

function usage() {
	return [
		"Usage:",
		"  pnpm --filter @app/web run find-logos -- schoolai.com",
		"  pnpm --filter @app/web run find-logos -- --input domains.csv --output logos.csv",
		"",
		"CSV input can be one domain per row or include a domain, website, website_url, url, or link column.",
	].join("\n");
}

function optionValue(args: string[], index: number, name: string) {
	const value = args[index + 1];

	if (!value || value.startsWith("--")) {
		throw new Error(`${name} requires a value.`);
	}

	return value;
}

function parsePositiveInteger(value: string, name: string) {
	const parsed = Number.parseInt(value, 10);

	if (!Number.isFinite(parsed) || parsed < 1) {
		throw new Error(`${name} must be a positive integer.`);
	}

	return parsed;
}

function parseArgs(args: string[]): CliOptions {
	const positional: string[] = [];
	let inputPath: string | undefined;
	let outputPath: string | undefined;
	let concurrency = DEFAULT_CONCURRENCY;
	let maxCandidates = DEFAULT_MAX_CANDIDATES;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		if (!arg) continue;
		if (arg === "--") continue;

		if (arg === "--help" || arg === "-h") {
			console.log(usage());
			process.exit(0);
		}

		if (arg === "--input" || arg === "-i") {
			inputPath = optionValue(args, index, arg);
			index += 1;
			continue;
		}

		if (arg === "--output" || arg === "-o") {
			outputPath = optionValue(args, index, arg);
			index += 1;
			continue;
		}

		if (arg === "--concurrency" || arg === "-c") {
			concurrency = parsePositiveInteger(optionValue(args, index, arg), arg);
			index += 1;
			continue;
		}

		if (arg === "--max-candidates") {
			maxCandidates = parsePositiveInteger(optionValue(args, index, arg), arg);
			index += 1;
			continue;
		}

		if (arg.startsWith("-")) {
			throw new Error(`Unknown option: ${arg}`);
		}

		positional.push(arg);
	}

	if (inputPath && positional.length > 0) {
		throw new Error("Pass either a domain or --input, not both.");
	}

	if (!inputPath && positional.length !== 1) {
		throw new Error(usage());
	}

	return {
		concurrency,
		domain: positional[0],
		inputPath,
		maxCandidates,
		outputPath,
	};
}

function normalizeImportHeader(value: string) {
	return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeDomain(input: string): string | undefined {
	const cleaned = input.trim().replace(/^['"]|['"]$/g, "");

	if (!cleaned) return undefined;

	try {
		const withProtocol = /^https?:\/\//i.test(cleaned)
			? cleaned
			: `https://${cleaned.replace(/^\/\//, "")}`;
		const parsed = new URL(withProtocol);

		if (!parsed.hostname.includes(".")) return undefined;

		return parsed.hostname.toLowerCase();
	} catch {
		return undefined;
	}
}

function pickDomain(row: Record<string, string>) {
	for (const column of DOMAIN_COLUMNS) {
		const value = row[column];

		if (value) return normalizeDomain(value);
	}

	return undefined;
}

function parseDomainsFromCsv(csv: string) {
	const headerParsed = Papa.parse<Record<string, string>>(csv, {
		header: true,
		skipEmptyLines: "greedy",
		transformHeader: normalizeImportHeader,
	});
	const fields = headerParsed.meta.fields ?? [];
	const hasKnownDomainHeader = fields.some((field) =>
		DOMAIN_COLUMNS.includes(field),
	);

	if (hasKnownDomainHeader) {
		return headerParsed.data.flatMap((row) => {
			const domain = pickDomain(row);
			return domain ? [domain] : [];
		});
	}

	const rowsParsed = Papa.parse<string[]>(csv, {
		skipEmptyLines: "greedy",
	});

	return rowsParsed.data.flatMap((row, index) => {
		const firstCell = row[0]?.trim();

		if (!firstCell) return [];
		if (
			index === 0 &&
			DOMAIN_COLUMNS.includes(normalizeImportHeader(firstCell))
		) {
			return [];
		}

		const domain = normalizeDomain(firstCell);
		return domain ? [domain] : [];
	});
}

function uniqueDomains(domains: string[]) {
	const seen = new Set<string>();
	const unique: string[] = [];

	for (const domain of domains) {
		if (seen.has(domain)) continue;

		seen.add(domain);
		unique.push(domain);
	}

	return unique;
}

function resolveUrl(raw: string | undefined, baseUrl: string): string | null {
	if (!raw) return null;

	const trimmed = raw.trim();

	if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
		return null;
	}

	try {
		const resolved = new URL(trimmed, baseUrl);
		resolved.hash = "";
		return resolved.toString();
	} catch {
		return null;
	}
}

function addCandidate(
	candidates: Candidate[],
	url: string | null,
	source: string,
	score: number,
	notes: string[] = [],
) {
	if (!url) return;

	const existing = candidates.find((candidate) => candidate.url === url);

	if (existing) {
		existing.score += score;
		existing.notes = uniqueNotes([
			...existing.notes,
			...notes,
			`also found via ${source}`,
		]);
		return;
	}

	candidates.push({ notes: uniqueNotes(notes), score, source, url });
}

function uniqueNotes(notes: string[]) {
	return Array.from(new Set(notes.filter(Boolean)));
}

function scoreUrl(url: string) {
	const lower = url.toLowerCase();
	let score = 0;
	const notes: string[] = [];

	if (lower.includes("logo")) {
		score += 40;
		notes.push("URL contains logo");
	}

	if (lower.includes("brand")) {
		score += 15;
		notes.push("URL contains brand");
	}

	if (lower.endsWith(".svg")) {
		score += 20;
		notes.push("SVG logo candidate");
	}

	if (lower.endsWith(".png")) {
		score += 15;
		notes.push("PNG candidate");
	}

	if (lower.includes("favicon")) {
		score -= 20;
		notes.push("favicon fallback");
	}

	if (lower.includes("og") || lower.includes("social")) {
		score -= 10;
		notes.push("social image fallback");
	}

	return { notes, score };
}

function firstSrcsetUrl(srcset: string | undefined) {
	const firstEntry = srcset?.split(",").at(0)?.trim();

	if (!firstEntry) return undefined;

	return firstEntry.split(/\s+/).at(0);
}

function imageSource(image: ReturnType<cheerio.CheerioAPI>) {
	return (
		image.attr("src") ||
		image.attr("data-src") ||
		image.attr("data-lazy-src") ||
		image.attr("data-original") ||
		firstSrcsetUrl(image.attr("srcset")) ||
		firstSrcsetUrl(image.attr("data-srcset"))
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeIncludesOrganization(value: unknown): boolean {
	if (typeof value === "string") {
		return value.toLowerCase().includes("organization");
	}

	if (Array.isArray(value)) {
		return value.some(typeIncludesOrganization);
	}

	return false;
}

function logoUrlFromJsonLd(value: unknown) {
	if (typeof value === "string") return value;

	if (!isRecord(value)) return undefined;

	const url = value.url ?? value["@id"];

	return typeof url === "string" ? url : undefined;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

function homepageUrls(domain: string) {
	const candidates = [`https://${domain}`, `http://${domain}`];

	if (!domain.startsWith("www.")) {
		candidates.splice(1, 0, `https://www.${domain}`);
		candidates.push(`http://www.${domain}`);
	}

	return candidates;
}

async function fetchHomepage(domain: string) {
	const errors: string[] = [];

	for (const homepageUrl of homepageUrls(domain)) {
		try {
			const response = await fetchWithTimeout(homepageUrl, {
				headers: {
					Accept: "text/html,application/xhtml+xml",
					"User-Agent": USER_AGENT,
				},
				redirect: "follow",
			});

			if (response.ok) {
				return { finalUrl: response.url, html: await response.text() };
			}

			errors.push(`${homepageUrl}: ${response.status}`);
		} catch (error) {
			errors.push(
				`${homepageUrl}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	throw new Error(`Failed to fetch homepage (${errors.join("; ")})`);
}

function collectJsonLdCandidates(
	$: cheerio.CheerioAPI,
	finalUrl: string,
	candidates: Candidate[],
) {
	$('script[type="application/ld+json"]').each((_, element) => {
		const raw = $(element).text();

		try {
			const parsed: unknown = JSON.parse(raw);
			const items = Array.isArray(parsed) ? parsed : [parsed];

			for (const item of items) {
				if (!isRecord(item)) continue;

				const graphValue = item["@graph"];
				const graph = Array.isArray(graphValue) ? graphValue : [item];

				for (const node of graph) {
					if (!isRecord(node)) continue;

					if (!typeIncludesOrganization(node["@type"])) continue;

					addCandidate(
						candidates,
						resolveUrl(logoUrlFromJsonLd(node.logo), finalUrl),
						"jsonld.organization.logo",
						90,
						["JSON-LD Organization.logo"],
					);
				}
			}
		} catch {
			// Ignore malformed JSON-LD.
		}
	});
}

function collectImageCandidates(
	$: cheerio.CheerioAPI,
	finalUrl: string,
	candidates: Candidate[],
) {
	$("header img, nav img, [class*=header] img, [class*=nav] img").each(
		(_, element) => {
			const image = $(element);
			const alt = (image.attr("alt") || "").toLowerCase();
			const className = (image.attr("class") || "").toLowerCase();
			const resolved = resolveUrl(imageSource(image), finalUrl);

			let score = 65;
			const notes = ["image appears in header/nav"];

			if (alt.includes("logo")) {
				score += 30;
				notes.push("alt contains logo");
			}

			if (className.includes("logo")) {
				score += 25;
				notes.push("class contains logo");
			}

			const urlScore = scoreUrl(resolved || "");
			addCandidate(
				candidates,
				resolved,
				"header.nav.img",
				score + urlScore.score,
				[...notes, ...urlScore.notes],
			);
		},
	);

	$("img").each((_, element) => {
		const image = $(element);
		const alt = (image.attr("alt") || "").toLowerCase();
		const className = (image.attr("class") || "").toLowerCase();
		const resolved = resolveUrl(imageSource(image), finalUrl);
		const lowerUrl = (resolved || "").toLowerCase();

		if (
			alt.includes("logo") ||
			className.includes("logo") ||
			lowerUrl.includes("logo")
		) {
			const urlScore = scoreUrl(resolved || "");
			addCandidate(candidates, resolved, "logoish.img", 55 + urlScore.score, [
				"image has logo-like alt/class/src",
				...urlScore.notes,
			]);
		}
	});
}

function collectHeadCandidates(
	$: cheerio.CheerioAPI,
	finalUrl: string,
	candidates: Candidate[],
) {
	$(
		'link[rel*="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]',
	).each((_, element) => {
		const href = $(element).attr("href");
		const rel = ($(element).attr("rel") || "").toLowerCase();
		const score = rel.includes("apple") ? 35 : 20;

		addCandidate(candidates, resolveUrl(href, finalUrl), `head.${rel}`, score, [
			"head icon fallback",
		]);
	});

	const ogLogo =
		$('meta[property="og:logo"]').attr("content") ||
		$('meta[name="og:logo"]').attr("content");
	const ogImage =
		$('meta[property="og:image"]').attr("content") ||
		$('meta[name="og:image"]').attr("content");

	addCandidate(candidates, resolveUrl(ogLogo, finalUrl), "og.logo", 45, [
		"Open Graph logo fallback",
	]);
	addCandidate(candidates, resolveUrl(ogImage, finalUrl), "og.image", 25, [
		"Open Graph image fallback",
	]);
	addCandidate(
		candidates,
		resolveUrl("/favicon.ico", finalUrl),
		"favicon.ico",
		5,
		["last-resort favicon.ico"],
	);
}

function hasImageExtension(url: string) {
	return /\.(avif|gif|ico|jpe?g|png|svg|webp)(\?.*)?$/i.test(url);
}

function isValidAssetResponse(response: Response, url: string) {
	if (!response.ok) return false;

	const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

	if (!contentType) return hasImageExtension(url);
	if (contentType.includes("image/")) return true;
	if (contentType.includes("application/octet-stream"))
		return hasImageExtension(url);
	if (
		contentType.includes("text/plain") &&
		url.toLowerCase().includes(".svg")
	) {
		return true;
	}

	return false;
}

async function exists(url: string) {
	try {
		const headResponse = await fetchWithTimeout(url, {
			headers: { "User-Agent": USER_AGENT },
			method: "HEAD",
			redirect: "follow",
		});

		if (isValidAssetResponse(headResponse, url)) return true;

		const getResponse = await fetchWithTimeout(url, {
			headers: {
				Range: "bytes=0-2048",
				"User-Agent": USER_AGENT,
			},
			method: "GET",
			redirect: "follow",
		});

		return isValidAssetResponse(getResponse, url);
	} catch {
		return false;
	}
}

async function discoverLogo(
	domain: string,
	maxCandidates: number,
): Promise<LogoResult> {
	try {
		const { finalUrl, html } = await fetchHomepage(domain);
		const $ = cheerio.load(html);
		const candidates: Candidate[] = [];

		collectJsonLdCandidates($, finalUrl, candidates);
		collectImageCandidates($, finalUrl, candidates);
		collectHeadCandidates($, finalUrl, candidates);

		const rankedCandidates = candidates
			.sort((left, right) => right.score - left.score)
			.slice(0, maxCandidates);
		const validated: Candidate[] = [];

		for (const candidate of rankedCandidates) {
			if (await exists(candidate.url)) {
				validated.push(candidate);
			}
		}

		const best = validated.at(0);

		return {
			candidates: validated,
			domain,
			error: best ? "" : "No valid logo candidates found.",
			homepageUrl: finalUrl,
			logoUrl: best?.url ?? "",
			notes: best?.notes.join("; ") ?? "",
			score: best?.score,
			source: best?.source ?? "",
		};
	} catch (error) {
		return {
			candidates: [],
			domain,
			error: error instanceof Error ? error.message : String(error),
			homepageUrl: "",
			logoUrl: "",
			notes: "",
			score: undefined,
			source: "",
		};
	}
}

async function mapWithConcurrency<T, U>(
	items: T[],
	concurrency: number,
	mapper: (item: T, index: number) => Promise<U>,
) {
	const results = new Map<number, U>();
	let nextIndex = 0;

	const workers = Array.from(
		{ length: Math.min(concurrency, items.length) },
		async () => {
			while (true) {
				const currentIndex = nextIndex;
				nextIndex += 1;

				const item = items[currentIndex];

				if (item === undefined) break;

				results.set(currentIndex, await mapper(item, currentIndex));
			}
		},
	);

	await Promise.all(workers);

	return items.flatMap((_, index) => {
		const result = results.get(index);
		return result === undefined ? [] : [result];
	});
}

function resultsToCsv(results: LogoResult[]) {
	return Papa.unparse(
		results.map((result) => ({
			domain: result.domain,
			error: result.error,
			homepage_url: result.homepageUrl,
			logo_url: result.logoUrl,
			notes: result.notes,
			score: result.score ?? "",
			source: result.source,
		})),
		{
			columns: [
				"domain",
				"logo_url",
				"source",
				"score",
				"notes",
				"homepage_url",
				"error",
			],
		},
	);
}

function printSingleResult(result: LogoResult) {
	console.log(`Homepage: ${result.homepageUrl || "unavailable"}`);
	console.log("");

	if (!result.logoUrl) {
		console.log(result.error || "No valid logo candidates found.");
		return;
	}

	console.log("Best candidate:");
	console.log(
		JSON.stringify(
			{
				notes: result.notes.split("; ").filter(Boolean),
				score: result.score,
				source: result.source,
				url: result.logoUrl,
			},
			null,
			2,
		),
	);
	console.log("");

	console.log("All valid candidates:");
	console.table(
		result.candidates.map((candidate) => ({
			notes: candidate.notes.join("; "),
			score: candidate.score,
			source: candidate.source,
			url: candidate.url,
		})),
	);
}

async function readInputDomains(inputPath: string) {
	const absolutePath = path.resolve(process.cwd(), inputPath);
	const csv = await readFile(absolutePath, "utf8");
	return uniqueDomains(parseDomainsFromCsv(csv));
}

async function writeCsv(outputPath: string | undefined, csv: string) {
	if (!outputPath) {
		console.log(csv);
		return;
	}

	const absolutePath = path.resolve(process.cwd(), outputPath);
	await writeFile(absolutePath, `${csv}\n`, "utf8");
	console.error(`Wrote ${absolutePath}`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const domains = options.inputPath
		? await readInputDomains(options.inputPath)
		: uniqueDomains(
				[options.domain].flatMap((domain) => (domain ? [domain] : [])),
			);

	if (domains.length === 0) {
		throw new Error("No valid domains found.");
	}

	if (options.inputPath) {
		console.error(`Finding logos for ${domains.length} domains...`);
	}

	const results = await mapWithConcurrency(
		domains,
		options.concurrency,
		async (domain, index) => {
			if (options.inputPath) {
				console.error(`[${index + 1}/${domains.length}] ${domain}`);
			}

			return discoverLogo(domain, options.maxCandidates);
		},
	);

	if (!options.inputPath && !options.outputPath) {
		const result = results.at(0);

		if (!result) throw new Error("No result returned.");

		printSingleResult(result);
		return;
	}

	await writeCsv(options.outputPath, resultsToCsv(results));
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
