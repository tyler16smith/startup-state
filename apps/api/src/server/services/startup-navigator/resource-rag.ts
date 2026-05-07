import OpenAI from "openai";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { createApiError } from "~/server/api-context";
import type { PrismaClient } from "../../../../generated/prisma";

type Db = PrismaClient;

export type ResourceSemanticQuery = {
	q?: string;
	stage?: string;
	sector?: string;
	goal?: string;
	region?: string;
	businessType?: string;
	status?: string;
};

export type ResourceSemanticMatch = {
	resourceId: string;
	distance: number;
	rerankScore?: number;
};

type ResourceVectorRow = ResourceSemanticMatch & {
	content: string;
};

const embeddingModel =
	process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const rerankModel = process.env.COHERE_RERANK_MODEL ?? "rerank-v3.5";

let openaiClient: OpenAI | undefined;

function getOpenAIClient() {
	if (openaiClient) return openaiClient;
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return undefined;
	openaiClient = new OpenAI({ apiKey });
	return openaiClient;
}

export function isResourceEmbeddingConfigured() {
	return Boolean(process.env.OPENAI_API_KEY);
}

function isRerankConfigured() {
	return Boolean(process.env.COHERE_API_KEY);
}

function toPgVector(values: number[]) {
	return `[${values.join(",")}]`;
}

function semanticQueryText(input: ResourceSemanticQuery) {
	return [
		input.q ? `Query: ${input.q}` : null,
		input.stage ? `Founder stage: ${input.stage}` : null,
		input.sector ? `Sector: ${input.sector}` : null,
		input.goal ? `Goal or need: ${input.goal}` : null,
		input.region ? `Region: ${input.region}` : null,
		input.businessType ? `Business type: ${input.businessType}` : null,
	]
		.filter(Boolean)
		.join("\n")
		.trim();
}

async function createEmbedding(text: string) {
	const client = getOpenAIClient();
	if (!client) return null;

	const response = await client.embeddings.create({
		model: embeddingModel,
		input: text,
	});
	const firstEmbedding = response.data.at(0)?.embedding;
	if (!firstEmbedding) {
		throw createApiError("Embedding provider returned no embedding", 502);
	}
	return firstEmbedding;
}

export async function upsertResourceEmbedding(input: {
	db: Db;
	resourceId: string;
	content: string;
	requireProvider?: boolean;
}) {
	const content = input.content.trim();
	if (!content) return { embedded: false };

	await input.db.resourceEmbedding.upsert({
		where: { resourceId: input.resourceId },
		create: { resourceId: input.resourceId, content },
		update: { content },
	});

	const embedding = await createEmbedding(content);
	if (!embedding) {
		if (input.requireProvider) {
			throw createApiError(
				"OPENAI_API_KEY is required for resource reindexing",
				501,
			);
		}
		return { embedded: false };
	}

	await input.db.$executeRaw`
		UPDATE "ResourceEmbedding"
		SET "embedding" = ${toPgVector(embedding)}::vector, "updatedAt" = NOW()
		WHERE "resourceId" = ${input.resourceId}
	`;

	return { embedded: true };
}

const cohereRerankResponseSchema = z.object({
	results: z.array(
		z.object({
			index: z.number().int().min(0),
			relevance_score: z.number().optional(),
		}),
	),
});

async function rerankResourceRows(input: {
	queryText: string;
	rows: ResourceVectorRow[];
	topN: number;
}) {
	const apiKey = process.env.COHERE_API_KEY;
	if (!apiKey || input.rows.length === 0)
		return input.rows.slice(0, input.topN);

	try {
		const response = await fetch("https://api.cohere.com/v2/rerank", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: rerankModel,
				query: input.queryText,
				documents: input.rows.map((row) => row.content),
				top_n: input.topN,
			}),
		});

		if (!response.ok) {
			logger.warn("Resource rerank request failed", {
				feature: "startup-navigator",
				operation: "resourceRerank",
				status: response.status,
			});
			return input.rows.slice(0, input.topN);
		}

		const parsed = cohereRerankResponseSchema.safeParse(await response.json());
		if (!parsed.success) return input.rows.slice(0, input.topN);

		return parsed.data.results.flatMap((result) => {
			const row = input.rows.at(result.index);
			if (!row) return [];
			return [{ ...row, rerankScore: result.relevance_score }];
		});
	} catch (error) {
		logger.warn("Resource rerank failed", {
			feature: "startup-navigator",
			operation: "resourceRerank",
			error: error instanceof Error ? error.message : String(error),
		});
		return input.rows.slice(0, input.topN);
	}
}

export async function findRelevantResourceMatches(input: {
	db: Db;
	query: ResourceSemanticQuery;
	candidateLimit?: number;
	resultLimit?: number;
}) {
	const queryText = semanticQueryText(input.query);
	if (!queryText || !isResourceEmbeddingConfigured()) return [];

	let embedding: number[] | null;
	try {
		embedding = await createEmbedding(queryText);
	} catch (error) {
		logger.warn("Resource semantic query embedding failed", {
			feature: "startup-navigator",
			operation: "resourceSemanticSearch",
			error: error instanceof Error ? error.message : String(error),
		});
		return [];
	}
	if (!embedding) return [];

	const candidateLimit = input.candidateLimit ?? 30;
	const resultLimit = input.resultLimit ?? 8;
	const status = input.query.status ?? "PUBLISHED";
	const queryVector = toPgVector(embedding);

	const rows = await input.db.$queryRaw<ResourceVectorRow[]>`
		SELECT
			r."id" AS "resourceId",
			re."content" AS "content",
			re."embedding" <=> ${queryVector}::vector AS "distance"
		FROM "ResourceEmbedding" re
		JOIN "Resource" r ON r."id" = re."resourceId"
		WHERE re."embedding" IS NOT NULL
			AND r."status"::text = ${status}
			AND (${input.query.stage ?? null}::text IS NULL OR ${input.query.stage ?? null} = ANY(r."stages"))
			AND (${input.query.sector ?? null}::text IS NULL OR ${input.query.sector ?? null} = ANY(r."sectors"))
			AND (${input.query.goal ?? null}::text IS NULL OR ${input.query.goal ?? null} = ANY(r."goals"))
			AND (${input.query.region ?? null}::text IS NULL OR ${input.query.region ?? null} = ANY(r."regions"))
			AND (${input.query.businessType ?? null}::text IS NULL OR ${input.query.businessType ?? null} = ANY(r."businessTypes"))
		ORDER BY re."embedding" <=> ${queryVector}::vector
		LIMIT ${candidateLimit}
	`;

	const reranked = isRerankConfigured()
		? await rerankResourceRows({ queryText, rows, topN: resultLimit })
		: rows.slice(0, resultLimit);

	return reranked.map(({ content: _content, ...match }) => match);
}
