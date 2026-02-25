/**
 * MCI-027: search_similar_learnings — pgvector search + confidence filter
 * Spec: 04-agent-design.md §4.3 #7
 */
import type {
  SearchSimilarLearningsInput,
  SearchSimilarLearningsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';
import { generateEmbedding } from '../../../workers/algorithm/embedding-batch.js';

export async function searchSimilarLearnings(
  input: SearchSimilarLearningsInput,
): Promise<SearchSimilarLearningsOutput> {
  if (!input.query_text || input.query_text.trim().length === 0) {
    throw new McpValidationError('query_text is required');
  }

  const limit = input.limit ?? 10;
  const minConfidence = input.min_confidence ?? 0.5;

  if (minConfidence < 0 || minConfidence > 1) {
    throw new McpValidationError('min_confidence must be between 0 and 1');
  }

  const pool = getPool();
  const embedding = await generateEmbedding(input.query_text);
  const embeddingStr = `[${embedding.join(',')}]`;

  const res = await pool.query(
    `SELECT id, insight, confidence, 1 - (embedding <=> $1::vector) AS similarity
     FROM learnings
     WHERE embedding IS NOT NULL
       AND confidence >= $2
       AND 1 - (embedding <=> $1::vector) > 0.0
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [embeddingStr, minConfidence, limit],
  );

  return {
    results: res.rows.map((r: Record<string, unknown>) => ({
      id: r['id'] as number,
      insight: r['insight'] as string,
      confidence: Number(r['confidence']),
      similarity: Number(r['similarity']),
    })),
  };
}
