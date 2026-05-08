RAG implementation

Here’s a minimal TypeScript setup:
Unstructured chunks → Neon Postgres/pgvector → vector topK → Cohere rerank → OpenAI answer
Neon supports pgvector, and pgvector supports HNSW indexes for fast approximate vector search. Cohere Rerank takes candidate texts and reorders them by relevance.  
Install
npm i openai cohere-ai pg zod
npm i -D @types/pg tsx dotenv
.env
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="..."
COHERE_API_KEY="..."
src/rag/db.ts
import pg from "pg";

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
src/rag/schema.sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  source text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  text text NOT NULL,
  metadata jsonb DEFAULT '{}',
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
ON document_chunks
USING hnsw (embedding vector_cosine_ops);
src/rag/setup.ts
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

async function main() {
  const sql = await fs.readFile(path.join(process.cwd(), "src/rag/schema.sql"), "utf8");
  await db.query(sql);
  console.log("RAG schema ready");
  await db.end();
}

main().catch(async (err) => {
  console.error(err);
  await db.end();
  process.exit(1);
});
Run once:
npx tsx src/rag/setup.ts
src/rag/openai.ts
import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return res.data[0].embedding;
}

export async function answerWithContext(params: {
  question: string;
  chunks: Array<{ text: string; source?: string; title?: string }>;
}) {
  const context = params.chunks
    .map((chunk, i) => {
      return `<chunk index="${i + 1}" source="${chunk.source ?? ""}" title="${chunk.title ?? ""}">
${chunk.text}
</chunk>`;
    })
    .join("\n\n");

  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Answer using only the provided context. If the context is insufficient, say you don't know. Cite chunk numbers when useful.",
      },
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${params.question}`,
      },
    ],
  });

  return res.choices[0].message.content ?? "";
}
src/rag/vector.ts
export function toPgVector(values: number[]) {
  return `[${values.join(",")}]`;
}
src/rag/ingest.ts
import "dotenv/config";
import { db } from "./db";
import { embedText } from "./openai";
import { toPgVector } from "./vector";

export type UnstructuredChunk = {
  text: string;
  metadata?: Record<string, unknown>;
};

export async function ingestDocument(params: {
  title: string;
  source?: string;
  metadata?: Record<string, unknown>;
  chunks: UnstructuredChunk[];
}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const docResult = await client.query<{ id: string }>(
      `
      INSERT INTO documents (title, source, metadata)
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [params.title, params.source ?? null, params.metadata ?? {}],
    );

    const documentId = docResult.rows[0].id;

    for (const [index, chunk] of params.chunks.entries()) {
      const text = chunk.text.trim();
      if (!text) continue;

      const embedding = await embedText(text);

      await client.query(
        `
        INSERT INTO document_chunks (
          document_id,
          chunk_index,
          text,
          metadata,
          embedding
        )
        VALUES ($1, $2, $3, $4, $5::vector)
        `,
        [
          documentId,
          index,
          text,
          chunk.metadata ?? {},
          toPgVector(embedding),
        ],
      );
    }

    await client.query("COMMIT");
    return { documentId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
src/rag/retrieve.ts
import { CohereClient } from "cohere-ai";
import { db } from "./db";
import { embedText } from "./openai";
import { toPgVector } from "./vector";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

export type RetrievedChunk = {
  id: string;
  documentId: string;
  title: string | null;
  source: string | null;
  text: string;
  metadata: Record<string, unknown>;
  distance: number;
};

export async function retrieveRelevantChunks(question: string) {
  const queryEmbedding = await embedText(question);

  const vectorResults = await db.query<RetrievedChunk>(
    `
    SELECT
      c.id,
      c.document_id AS "documentId",
      d.title,
      d.source,
      c.text,
      c.metadata,
      c.embedding <=> $1::vector AS distance
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> $1::vector
    LIMIT 30
    `,
    [toPgVector(queryEmbedding)],
  );

  const candidates = vectorResults.rows;

  if (candidates.length === 0) {
    return [];
  }

  const reranked = await cohere.rerank({
    model: "rerank-v3.5",
    query: question,
    documents: candidates.map((c) => c.text),
    topN: 6,
  });

  return reranked.results.map((result) => {
    return candidates[result.index];
  });
}
src/rag/ask.ts
import { answerWithContext } from "./openai";
import { retrieveRelevantChunks } from "./retrieve";

export async function askRag(question: string) {
  const chunks = await retrieveRelevantChunks(question);

  const answer = await answerWithContext({
    question,
    chunks: chunks.map((chunk) => ({
      text: chunk.text,
      title: chunk.title ?? undefined,
      source: chunk.source ?? undefined,
    })),
  });

  return {
    answer,
    sources: chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      title: chunk.title,
      source: chunk.source,
      metadata: chunk.metadata,
    })),
  };
}
Example usage
import "dotenv/config";
import { ingestDocument } from "./rag/ingest";
import { askRag } from "./rag/ask";

async function main() {
  await ingestDocument({
    title: "Sample handbook",
    source: "upload/sample-handbook.pdf",
    chunks: [
      {
        text: "Refunds are available within 30 days of purchase.",
        metadata: { pageNumber: 1 },
      },
      {
        text: "Enterprise customers should contact support for custom billing terms.",
        metadata: { pageNumber: 2 },
      },
    ],
  });

  const result = await askRag("What is the refund policy?");
  console.log(result.answer);
  console.log(result.sources);
}

main().catch(console.error);
Next.js API route example
app/api/chat/route.ts
import { askRag } from "@/src/rag/ask";

export async function POST(req: Request) {
  const body = await req.json();

  const question = String(body.question ?? "").trim();

  if (!question) {
    return Response.json({ error: "Missing question" }, { status: 400 });
  }

  const result = await askRag(question);

  return Response.json(result);
}
That’s the minimal hackathon version.