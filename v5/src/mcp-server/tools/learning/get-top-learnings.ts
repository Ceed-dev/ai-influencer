/**
 * MCI-028: get_top_learnings — top N by confidence
 * Spec: 04-agent-design.md §4.1 #3
 */
import type {
  GetTopLearningsInput,
  GetTopLearningsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function getTopLearnings(
  input: GetTopLearningsInput,
): Promise<GetTopLearningsOutput> {
  const limit = input.limit ?? 10;
  const minConfidence = input.min_confidence ?? 0.7;

  if (limit < 1 || limit > 100) {
    throw new McpValidationError('limit must be between 1 and 100');
  }
  if (minConfidence < 0 || minConfidence > 1) {
    throw new McpValidationError('min_confidence must be between 0 and 1');
  }

  const pool = getPool();

  const res = await pool.query(
    `SELECT insight, confidence, evidence_count, category
     FROM learnings
     WHERE confidence >= $1
     ORDER BY confidence DESC, evidence_count DESC
     LIMIT $2`,
    [minConfidence, limit],
  );

  return {
    learnings: res.rows.map((r: Record<string, unknown>) => ({
      insight: r['insight'] as string,
      confidence: Number(r['confidence']),
      evidence_count: r['evidence_count'] as number,
      category: r['category'] as string,
    })),
  };
}
