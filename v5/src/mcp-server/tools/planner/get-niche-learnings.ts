/**
 * FEAT-MCC-010: get_niche_learnings
 * Spec: 04-agent-design.md S4.4 #7
 * Returns learnings applicable to a specific niche with confidence filtering.
 */
import type {
  GetNicheLearningsInput,
  GetNicheLearningsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function getNicheLearnings(
  input: GetNicheLearningsInput,
): Promise<GetNicheLearningsOutput> {
  if (!input.niche || input.niche.trim().length === 0) {
    throw new McpValidationError('niche is required');
  }

  const minConfidence = input.min_confidence ?? 0.5;
  const limit = input.limit ?? 10;

  if (minConfidence < 0 || minConfidence > 1) {
    throw new McpValidationError('min_confidence must be between 0 and 1');
  }
  if (limit < 1 || limit > 100) {
    throw new McpValidationError('limit must be between 1 and 100');
  }

  const pool = getPool();

  const res = await pool.query(
    `SELECT insight, confidence, category
     FROM learnings
     WHERE $1 = ANY(applicable_niches)
       AND confidence >= $2
     ORDER BY confidence DESC, evidence_count DESC
     LIMIT $3`,
    [input.niche, minConfidence, limit],
  );

  return {
    learnings: res.rows.map((r: Record<string, unknown>) => ({
      insight: r['insight'] as string,
      confidence: Number(r['confidence']),
      category: r['category'] as string,
    })),
  };
}
