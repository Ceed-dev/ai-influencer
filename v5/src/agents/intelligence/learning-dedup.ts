/**
 * FEAT-INT-017: Learning deduplication via pgvector similarity
 * Spec: 04-agent-design.md §4.12, 02-architecture.md §7
 *
 * LEARNING_SIMILARITY_THRESHOLD (default: 0.85) — learnings with cosine
 * similarity above this threshold are considered duplicates.
 * Uses pgvector <=> operator for cosine distance.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';

/** Duplicate match result */
export interface DuplicateMatch {
  existingId: string;
  existingContent: string;
  similarity: number;
}

/** Dedup check result */
export interface DedupResult {
  isDuplicate: boolean;
  threshold: number;
  matches: DuplicateMatch[];
  bestMatch: DuplicateMatch | null;
}

/**
 * Check if a new learning is a duplicate of existing learnings
 * using pgvector cosine similarity search.
 *
 * @param client - Database client
 * @param embedding - 1536-dimension embedding vector of the new learning
 * @param agentType - Agent type to scope the search
 * @param threshold - Cosine similarity threshold (default from system_settings)
 * @param limit - Max number of similar learnings to return
 */
export async function checkLearningDuplicate(
  client: PoolClient,
  embedding: number[],
  agentType: string,
  threshold: number,
  limit: number = 5,
): Promise<DedupResult> {
  // pgvector: <=> returns cosine distance (1 - cosine_similarity)
  // So similarity = 1 - distance
  const res = await client.query(
    `SELECT id, content, 1 - (embedding <=> $1::vector) AS similarity
     FROM agent_individual_learnings
     WHERE agent_type = $2
       AND is_active = true
       AND embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) >= $3
     ORDER BY embedding <=> $1::vector ASC
     LIMIT $4`,
    [`[${embedding.join(',')}]`, agentType, threshold, limit],
  );

  const matches: DuplicateMatch[] = res.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      existingId: r['id'] as string,
      existingContent: r['content'] as string,
      similarity: Number(r['similarity']),
    };
  });

  const bestMatch = matches.length > 0 ? matches[0]! : null;

  return {
    isDuplicate: matches.length > 0,
    threshold,
    matches,
    bestMatch,
  };
}

/**
 * Check duplicate for global learnings table.
 */
export async function checkGlobalLearningDuplicate(
  client: PoolClient,
  embedding: number[],
  threshold: number,
  limit: number = 5,
): Promise<DedupResult> {
  const res = await client.query(
    `SELECT id::text, insight AS content, 1 - (embedding <=> $1::vector) AS similarity
     FROM learnings
     WHERE embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) >= $2
     ORDER BY embedding <=> $1::vector ASC
     LIMIT $3`,
    [`[${embedding.join(',')}]`, threshold, limit],
  );

  const matches: DuplicateMatch[] = res.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      existingId: r['id'] as string,
      existingContent: r['content'] as string,
      similarity: Number(r['similarity']),
    };
  });

  const bestMatch = matches.length > 0 ? matches[0]! : null;

  return {
    isDuplicate: matches.length > 0,
    threshold,
    matches,
    bestMatch,
  };
}
