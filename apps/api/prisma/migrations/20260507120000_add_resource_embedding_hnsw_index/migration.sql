CREATE INDEX IF NOT EXISTS "ResourceEmbedding_embedding_hnsw_idx"
ON "ResourceEmbedding"
USING hnsw ("embedding" vector_cosine_ops)
WHERE "embedding" IS NOT NULL;
