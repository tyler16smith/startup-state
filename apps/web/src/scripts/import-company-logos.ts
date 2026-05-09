import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { type Prisma, PrismaClient } from "../../../api/generated/prisma";

type CliOptions = {
	dryRun: boolean;
	inputPath: string;
};

type ParsedLogoRow = {
	domain: string;
	logoUrl: string;
	rowNumber: number;
};

const DOMAIN_COLUMNS = ["domain", "website", "website_url", "websiteurl"];
const LOGO_URL_COLUMNS = ["logo_url", "logourl", "logo", "url"];

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "../../../..");

function usage() {
	return [
		"Usage:",
		"  pnpm --filter @app/web run import-company-logos -- ~/Downloads/logos.csv",
		"  pnpm --filter @app/web run import-company-logos -- --input ~/Downloads/logos.csv",
		"",
		"CSV input must include domain and logo_url columns.",
	].join("\n");
}

function optionValue(args: string[], index: number, name: string) {
	const value = args[index + 1];

	if (!value || value.startsWith("--")) {
		throw new Error(`${name} requires a value.`);
	}

	return value;
}

function parseArgs(args: string[]): CliOptions {
	const positional: string[] = [];
	let dryRun = false;
	let inputPath: string | undefined;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];

		if (!arg || arg === "--") continue;

		if (arg === "--help" || arg === "-h") {
			console.log(usage());
			process.exit(0);
		}

		if (arg === "--dry-run") {
			dryRun = true;
			continue;
		}

		if (arg === "--input" || arg === "-i") {
			inputPath = optionValue(args, index, arg);
			index += 1;
			continue;
		}

		if (arg.startsWith("-")) {
			throw new Error(`Unknown option: ${arg}`);
		}

		positional.push(arg);
	}

	if (inputPath && positional.length > 0) {
		throw new Error("Pass either a positional CSV path or --input, not both.");
	}

	const resolvedInputPath = inputPath ?? positional.at(0);

	if (!resolvedInputPath || positional.length > 1) {
		throw new Error(usage());
	}

	return { dryRun, inputPath: resolvedInputPath };
}

function normalizeImportHeader(value: string) {
	return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function cleanCsvValue(value: unknown) {
	return typeof value === "string" ? value.trim() : "";
}

function parseEnvValue(value: string) {
	const trimmed = value.trim();

	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}

	return trimmed;
}

async function loadEnvFile(filePath: string) {
	try {
		const contents = await readFile(filePath, "utf8");

		for (const line of contents.split(/\r?\n/)) {
			const trimmed = line.trim();

			if (!trimmed || trimmed.startsWith("#")) continue;

			const equalsIndex = trimmed.indexOf("=");

			if (equalsIndex === -1) continue;

			const key = trimmed.slice(0, equalsIndex).trim();
			const value = parseEnvValue(trimmed.slice(equalsIndex + 1));

			if (key && process.env[key] === undefined) {
				process.env[key] = value;
			}
		}
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return;
		}

		throw error;
	}
}

async function loadDatabaseEnv() {
	await loadEnvFile(path.join(workspaceRoot, ".env"));
	await loadEnvFile(path.join(workspaceRoot, "apps/api/.env"));
}

function normalizeDomain(input: string): string | undefined {
	const cleaned = input.trim().replace(/^['"]|['"]$/g, "");

	if (!cleaned) return undefined;

	try {
		const withProtocol = /^https?:\/\//i.test(cleaned)
			? cleaned
			: `https://${cleaned.replace(/^\/\//, "")}`;
		const parsed = new URL(withProtocol);
		const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

		if (!hostname.includes(".")) return undefined;

		return hostname;
	} catch {
		return undefined;
	}
}

function normalizeLogoUrl(input: string): string | undefined {
	const cleaned = input.trim();

	if (!cleaned) return undefined;

	try {
		const parsed = new URL(cleaned);

		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return undefined;
		}

		parsed.hash = "";
		return parsed.toString();
	} catch {
		return undefined;
	}
}

function pickValue(row: Record<string, unknown>, columns: string[]) {
	for (const column of columns) {
		const value = cleanCsvValue(row[column]);

		if (value) return value;
	}

	return undefined;
}

function parseLogoRows(csv: string) {
	const parsed = Papa.parse<Record<string, unknown>>(csv, {
		header: true,
		skipEmptyLines: "greedy",
		transformHeader: normalizeImportHeader,
	});
	const rows: ParsedLogoRow[] = [];
	const errors: string[] = [];

	for (const [index, row] of parsed.data.entries()) {
		const rowNumber = index + 2;
		const rawDomain = pickValue(row, DOMAIN_COLUMNS);
		const rawLogoUrl = pickValue(row, LOGO_URL_COLUMNS);
		const domain = rawDomain ? normalizeDomain(rawDomain) : undefined;
		const logoUrl = rawLogoUrl ? normalizeLogoUrl(rawLogoUrl) : undefined;

		if (!rawDomain && !rawLogoUrl) continue;

		if (!domain) {
			errors.push(`Row ${rowNumber}: domain is missing or invalid`);
			continue;
		}

		if (!logoUrl) {
			errors.push(`Row ${rowNumber}: logo_url is missing or invalid`);
			continue;
		}

		rows.push({ domain, logoUrl, rowNumber });
	}

	for (const parseError of parsed.errors) {
		errors.push(`CSV parse error: ${parseError.message}`);
	}

	return { errors, rows };
}

function groupCompaniesByDomain(
	companies: Array<{ id: string; name: string; websiteUrl: string | null }>,
) {
	const byDomain = new Map<
		string,
		Array<{ id: string; name: string; websiteUrl: string | null }>
	>();

	for (const company of companies) {
		if (!company.websiteUrl) continue;

		const domain = normalizeDomain(company.websiteUrl);

		if (!domain) continue;

		byDomain.set(domain, [...(byDomain.get(domain) ?? []), company]);
	}

	return byDomain;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	await loadDatabaseEnv();

	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is required. Expected it in apps/api/.env.");
	}

	const inputPath = path.resolve(process.cwd(), options.inputPath);
	const csv = await readFile(inputPath, "utf8");
	const { errors, rows } = parseLogoRows(csv);
	const db = new PrismaClient();

	try {
		const companies = await db.company.findMany({
			select: { id: true, name: true, websiteUrl: true },
			where: { websiteUrl: { not: null } },
		});
		const companiesByDomain = groupCompaniesByDomain(companies);
		const matchedCompanyIds = new Set<string>();
		const candidateRows = rows.flatMap((row) => {
			const matches = companiesByDomain.get(row.domain) ?? [];

			if (matches.length === 0) {
				errors.push(`Row ${row.rowNumber}: no company found for ${row.domain}`);
				return [];
			}

			for (const company of matches) {
				matchedCompanyIds.add(company.id);
			}

			return matches.map((company) => ({ company, row }));
		});

		const existingPhotos = matchedCompanyIds.size
			? await db.companyPhoto.findMany({
					select: { companyId: true, sortOrder: true, url: true },
					where: { companyId: { in: Array.from(matchedCompanyIds) } },
				})
			: [];
		const existingPhotoKeys = new Set(
			existingPhotos.map((photo) => `${photo.companyId}:${photo.url}`),
		);
		const nextSortOrderByCompanyId = new Map<string, number>();

		for (const photo of existingPhotos) {
			const current = nextSortOrderByCompanyId.get(photo.companyId) ?? 0;
			nextSortOrderByCompanyId.set(
				photo.companyId,
				Math.max(current, photo.sortOrder + 1),
			);
		}

		const queuedPhotoKeys = new Set<string>();
		const createData: Prisma.CompanyPhotoCreateManyInput[] = [];
		let skippedExisting = 0;

		for (const { company, row } of candidateRows) {
			const key = `${company.id}:${row.logoUrl}`;

			if (existingPhotoKeys.has(key) || queuedPhotoKeys.has(key)) {
				skippedExisting += 1;
				continue;
			}

			const sortOrder = nextSortOrderByCompanyId.get(company.id) ?? 0;

			nextSortOrderByCompanyId.set(company.id, sortOrder + 1);
			queuedPhotoKeys.add(key);
			createData.push({
				altText: `${company.name} logo`,
				companyId: company.id,
				sortOrder,
				url: row.logoUrl,
			});
		}

		if (options.dryRun) {
			console.log(`Dry run: would import ${createData.length} company logos.`);
		} else if (createData.length > 0) {
			await db.companyPhoto.createMany({ data: createData });
			console.log(`Imported ${createData.length} company logos.`);
		} else {
			console.log("No company logos to import.");
		}

		if (skippedExisting > 0) {
			console.log(
				`Skipped ${skippedExisting} existing or duplicate logo rows.`,
			);
		}

		if (errors.length > 0) {
			console.log(`Skipped ${errors.length} rows with errors:`);
			for (const error of errors.slice(0, 25)) {
				console.log(`- ${error}`);
			}

			if (errors.length > 25) {
				console.log(`- ...and ${errors.length - 25} more`);
			}
		}
	} finally {
		await db.$disconnect();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
