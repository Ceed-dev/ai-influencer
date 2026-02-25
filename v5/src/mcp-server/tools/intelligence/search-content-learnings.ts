/**
 * MCI-030: search_content_learnings — content_learnings vector search
 * Spec: 04-agent-design.md §4.12 #9
 */
import type {
  SearchContentLearningsInput,
  SearchContentLearningsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function searchContentLearnings(
  input: SearchContentLearningsInput,
): Promise<SearchContentLearningsOutput> {
  if (!input.query_embedding || input.query_embedding.length === 0) {
    throw new McpValidationError('query_embedding is required and must not be empty');
  }

  const limit = input.limit ?? 10;
  const minConfidence = input.min_confidence ?? 0.5;

  if (minConfidence < 0 || minConfidence > 1) {
    throw new McpValidationError('min_confidence must be between 0 and 1');
  }

  const pool = getPool();
  const embeddingStr = `[${input.query_embedding.join(',')}]`;

  const conditions: string[] = [
    'embedding IS NOT NULL',
    `confidence >= $2`,
    `1 - (embedding <=> $1::vector) > 0.0`,
  ];
  const params: unknown[] = [embeddingStr, minConfidence];
  let paramIdx = 3;

  if (input.niche) {
    conditions.push(`niche = $${paramIdx++}`);
    params.push(input.niche);
  }

  params.push(limit);

  const res = await pool.query(
    `SELECT id, content_id, micro_verdict, key_insight, confidence,
            1 - (embedding <=> $1::vector) AS similarity,
            niche, created_at
     FROM content_learnings
     WHERE ${conditions.join(' AND ')}
     ORDER BY embedding <=> $1::vector
     LIMIT $${paramIdx}`,
    params,
  );

  return {
    learnings: res.rows.map((r: Record<string, unknown>) => ({
      id: r['id'] as string,
      content_id: r['content_id'] as string,
      micro_verdict: r['micro_verdict'] as 'confirmed' | 'inconclusive' | 'rejected',
      key_insight: r['key_insight'] as string | null,
      confidence: Number(r['confidence']),
      similarity: Number(r['similarity']),
      niche: r['niche'] as string | null,
      created_at: (r['created_at'] as Date).toISOString(),
    })),
  };
}
