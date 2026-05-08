import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { logger } from "~/lib/logger";
import { createApiError } from "~/server/api-context";
import type { Prisma, PrismaClient } from "../../../../generated/prisma";
import {
	investorCompanyRecommendationSchema,
	investorProfileInputSchema,
} from "./schemas";

type Db = PrismaClient;

const hiringStatuses = [
	"NOT_HIRING",
	"HIRING",
	"ACTIVELY_HIRING",
	"UNKNOWN",
] as const;

type HiringStatusValue = (typeof hiringStatuses)[number];

function isHiringStatus(value: string): value is HiringStatusValue {
	return hiringStatuses.some((status) => status === value);
}

const investorRankedCompanySchema = z.object({
	recommendations: z
		.array(
			z.object({
				companyId: z.string().min(1),
				why: z.string().min(10).max(500),
				score: z.number().min(0).max(100).optional(),
			}),
		)
		.min(1)
		.max(5),
});

const investorRankedCompanyJsonSchema = zodToJsonSchema(
	investorRankedCompanySchema,
	"InvestorCompanyRecommendations",
);

let openaiClient: OpenAI | undefined;

function getOpenAIClient() {
	if (openaiClient) return openaiClient;
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return undefined;
	openaiClient = new OpenAI({ apiKey });
	return openaiClient;
}

function containsInsensitive(value: string): Prisma.StringFilter {
	return { contains: value, mode: "insensitive" };
}

function listText(values: string[]) {
	return values.length ? values.join(", ") : "any";
}

function companyPromptPayload(companies: CompanyCandidate[]) {
	return companies.map((company) => ({
		id: company.id,
		name: company.name,
		description: company.description,
		sector: company.sector,
		stage: company.stage,
		city: company.city,
		county: company.county,
		employees: company.employees,
		employeeRange: company.employeeRange,
		hiringStatus: company.hiringStatus,
		yearFounded: company.yearFounded,
	}));
}

type CompanyCandidate = Prisma.CompanyGetPayload<{
	include: { photos: { orderBy: { sortOrder: "asc" }; take: 1 } };
}>;

function scoreCandidate(
	company: CompanyCandidate,
	input: InvestorProfileInput,
) {
	let score = 0;
	if (company.stage && input.stages.includes(company.stage)) score += 30;
	if (company.sector && input.sectors.includes(company.sector)) score += 30;
	if (
		(company.city && input.regions.includes(company.city)) ||
		(company.county && input.regions.includes(company.county)) ||
		(company.state && input.regions.includes(company.state))
	) {
		score += 15;
	}
	if (input.hiringStatuses.includes(company.hiringStatus)) score += 10;
	if (company.employees !== null) {
		if (
			input.employeeMin !== undefined &&
			company.employees >= input.employeeMin
		) {
			score += 5;
		}
		if (
			input.employeeMax !== undefined &&
			company.employees <= input.employeeMax
		) {
			score += 5;
		}
	}
	if (input.keywords) {
		const haystack = [
			company.name,
			company.description,
			company.sector,
			company.stage,
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();
		for (const keyword of input.keywords.toLowerCase().split(/[\s,]+/)) {
			if (keyword && haystack.includes(keyword)) score += 2;
		}
	}
	return score;
}

type InvestorProfileInput = z.infer<typeof investorProfileInputSchema>;

async function rankWithLlm(input: {
	profile: InvestorProfileInput;
	candidates: CompanyCandidate[];
}) {
	const client = getOpenAIClient();
	if (!client) {
		throw createApiError(
			"OPENAI_API_KEY is required for investor recommendations",
			501,
		);
	}

	const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
	const systemPrompt = [
		"You rank Utah startup companies for an investor research workflow.",
		"Return only JSON that matches the supplied schema.",
		"Choose up to five companies from the candidate list by id.",
		"Each why must be one or two concise sentences and grounded only in provided company data.",
	].join(" ");
	const userPrompt = JSON.stringify({
		investorFilters: {
			stages: listText(input.profile.stages),
			sectors: listText(input.profile.sectors),
			regions: listText(input.profile.regions),
			hiringStatuses: listText(input.profile.hiringStatuses),
			employeeMin: input.profile.employeeMin,
			employeeMax: input.profile.employeeMax,
			researchGoals: listText(input.profile.researchGoals),
			keywords: input.profile.keywords,
		},
		jsonSchema: investorRankedCompanyJsonSchema,
		candidateCompanies: companyPromptPayload(input.candidates),
	});

	let lastError: string | undefined;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			const response = await client.chat.completions.create({
				model,
				messages: [
					{ role: "system", content: systemPrompt },
					{
						role: "user",
						content:
							attempt === 1
								? userPrompt
								: `${userPrompt}\n\nPrevious JSON failed validation: ${lastError}. Return repaired JSON only.`,
					},
				],
				response_format: { type: "json_object" },
				temperature: 0.2,
			});
			const content = response.choices.at(0)?.message.content;
			if (!content) throw new Error("LLM returned no content");
			const parsedJson = JSON.parse(content) as unknown;
			const parsed = investorRankedCompanySchema.safeParse(parsedJson);
			if (parsed.success) return parsed.data;
			lastError = parsed.error.message;
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
			logger.warn("Investor recommendation ranking attempt failed", {
				feature: "startup-navigator",
				operation: "investorRecommend",
				attempt,
				error: lastError,
			});
		}
	}

	throw createApiError("Investor recommendations could not be ranked", 502);
}

export async function recommendCompaniesForInvestorProfile(
	db: Db,
	input: unknown,
) {
	const profile = investorProfileInputSchema.parse(input);
	const where: Prisma.CompanyWhereInput = { status: "PUBLISHED" };
	const and: Prisma.CompanyWhereInput[] = [];

	if (profile.stages.length)
		and.push({ stage: { in: profile.stages, mode: "insensitive" } });
	if (profile.sectors.length)
		and.push({ sector: { in: profile.sectors, mode: "insensitive" } });
	const validHiringStatuses = profile.hiringStatuses.filter(isHiringStatus);
	if (validHiringStatuses.length) {
		and.push({ hiringStatus: { in: validHiringStatuses } });
	}
	if (profile.regions.length) {
		and.push({
			OR: [
				{ city: { in: profile.regions, mode: "insensitive" } },
				{ county: { in: profile.regions, mode: "insensitive" } },
				{ state: { in: profile.regions, mode: "insensitive" } },
			],
		});
	}
	if (profile.employeeMin !== undefined || profile.employeeMax !== undefined) {
		and.push({
			employees: {
				...(profile.employeeMin !== undefined
					? { gte: profile.employeeMin }
					: {}),
				...(profile.employeeMax !== undefined
					? { lte: profile.employeeMax }
					: {}),
			},
		});
	}
	if (profile.keywords) {
		and.push({
			OR: [
				{ name: containsInsensitive(profile.keywords) },
				{ description: containsInsensitive(profile.keywords) },
				{ sector: containsInsensitive(profile.keywords) },
			],
		});
	}
	if (and.length) where.AND = and;

	let candidates = await db.company.findMany({
		where,
		include: { photos: { orderBy: { sortOrder: "asc" }, take: 1 } },
		orderBy: { updatedAt: "desc" },
		take: 40,
	});

	if (candidates.length < 5) {
		candidates = await db.company.findMany({
			where: { status: "PUBLISHED" },
			include: { photos: { orderBy: { sortOrder: "asc" }, take: 1 } },
			orderBy: { updatedAt: "desc" },
			take: 40,
		});
	}

	const candidatePool = candidates
		.map((company) => ({ company, score: scoreCandidate(company, profile) }))
		.sort((a, b) => b.score - a.score)
		.slice(0, 20)
		.map(({ company }) => company);

	if (candidatePool.length === 0) return { recommendations: [] };

	const ranked = await rankWithLlm({ profile, candidates: candidatePool });
	const companiesById = new Map(
		candidatePool.map((company) => [company.id, company]),
	);
	const recommendations = ranked.recommendations.flatMap(
		(recommendation, index) => {
			const company = companiesById.get(recommendation.companyId);
			if (!company) return [];
			return [
				investorCompanyRecommendationSchema.parse({
					rank: index + 1,
					company,
					why: recommendation.why,
					score: recommendation.score,
				}),
			];
		},
	);

	return { recommendations };
}
