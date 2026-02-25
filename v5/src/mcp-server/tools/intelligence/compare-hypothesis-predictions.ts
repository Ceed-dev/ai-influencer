/**
 * MCI-040: compare_hypothesis_predictions
 * Spec: 04-agent-design.md §4.3 #13
 *
 * For each hypothesis, gets predicted vs actual values and calculates error rate.
 */
import type {
  CompareHypothesisPredictionsInput,
  CompareHypothesisPredictionsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function compareHypothesisPredictions(
  input: CompareHypothesisPredictionsInput,
): Promise<CompareHypothesisPredictionsOutput> {
  if (!Array.isArray(input.hypothesis_ids) || input.hypothesis_ids.length === 0) {
    throw new McpValidationError('hypothesis_ids must be a non-empty array');
  }
  if (input.hypothesis_ids.length > 50) {
    throw new McpValidationError('hypothesis_ids must contain at most 50 entries');
  }

  const pool = getPool();

  const res = await pool.query(
    `SELECT id, predicted_kpis, actual_kpis
     FROM hypotheses
     WHERE id = ANY($1::int[])`,
    [input.hypothesis_ids],
  );

  const comparisons = res.rows.map((r: Record<string, unknown>) => {
    const predicted = (r['predicted_kpis'] as Record<string, number>) ?? {};
    const actual = (r['actual_kpis'] as Record<string, number>) ?? {};

    // Calculate error_rate: average relative error across all KPI keys
    const keys = new Set([...Object.keys(predicted), ...Object.keys(actual)]);
    let totalError = 0;
    let errorCount = 0;

    for (const key of keys) {
      const p = predicted[key];
      const a = actual[key];
      if (p !== undefined && a !== undefined && a !== 0) {
        totalError += Math.abs(p - a) / Math.abs(a);
        errorCount++;
      }
    }

    const error_rate = errorCount > 0 ? Number((totalError / errorCount).toFixed(4)) : 0;

    return {
      hypothesis_id: r['id'] as number,
      predicted,
      actual,
      error_rate,
    };
  });

  return { comparisons };
}
