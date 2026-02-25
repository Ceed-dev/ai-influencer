/**
 * MCI-029: get_active_hypotheses — SELECT hypotheses WHERE verdict='pending'
 * Spec: 04-agent-design.md §4.1 #4
 */
import type {
  GetActiveHypothesesInput,
  GetActiveHypothesesOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_VERDICTS = ['pending', 'confirmed', 'rejected', 'inconclusive'] as const;

export async function getActiveHypotheses(
  input: GetActiveHypothesesInput,
): Promise<GetActiveHypothesesOutput> {
  if (!VALID_VERDICTS.includes(input.verdict as typeof VALID_VERDICTS[number])) {
    throw new McpValidationError(
      `Invalid verdict: "${input.verdict}". Must be one of: ${VALID_VERDICTS.join(', ')}`,
    );
  }

  const pool = getPool();

  const res = await pool.query(
    `SELECT id, statement, category, predicted_kpis, evidence_count
     FROM hypotheses
     WHERE verdict = $1
     ORDER BY created_at DESC`,
    [input.verdict],
  );

  return {
    hypotheses: res.rows.map((r: Record<string, unknown>) => ({
      id: r['id'] as number,
      statement: r['statement'] as string,
      category: r['category'] as string,
      predicted_kpis: (r['predicted_kpis'] as Record<string, number>) ?? {},
      evidence_count: r['evidence_count'] as number,
    })),
  };
}
