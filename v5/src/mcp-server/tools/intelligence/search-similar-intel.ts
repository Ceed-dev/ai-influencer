/**
 * MCI-004: search_similar_intel — vector search using pgvector
 * Spec: 04-agent-design.md §4.2 #7
 */
import type {
  SearchSimilarIntelInput,
  SearchSimilarIntelOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db.js';
import { McpValidationError } from '../../errors.js';
import { generateEmbedding } from '../../../workers/algorithm/embedding-batch.js';

export async function searchSimilarIntel(
  input: SearchSimilarIntelInput,
): Promise<SearchSimilarIntelOutput> {
  if (!input.query_text || input.query_text.trim().length === 0) {
    throw new McpValidationError('query_text is required and must not be empty');
  }

  const limit = input.limit ?? 10;
  if (limit < 1 || limit > 100) {
    throw new McpValidationError('limit must be between 1 and 100');
  }

  const pool = getPool();
  const embedding = await generateEmbedding(input.query_text);
  const embeddingStr = `[${embedding.join(',')}]`;

  const res = await pool.query(
    `SELECT id, data, 1 - (embedding <=> $1::vector) AS similarity
     FROM market_intel
     WHERE embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) > 0.0
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [embeddingStr, limit],
  );

  return {
    results: res.rows.map((r: Record<string, unknown>) => ({
      id: r['id'] as number,
      data: r['data'] as Record<string, unknown>,
      similarity: Number(r['similarity']),
    })),
  };
}
