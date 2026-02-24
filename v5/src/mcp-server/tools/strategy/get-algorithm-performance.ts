/**
 * MCC-044: get_algorithm_performance
 * Spec: 04-agent-design.md §4.1 #5
 *
 * Queries algorithm_performance table for trend data.
 * Returns historical accuracy/error/improvement data for a given period type.
 */
import type {
  GetAlgorithmPerformanceInput,
  GetAlgorithmPerformanceOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PERIODS = ['weekly', 'daily'] as const;

export async function getAlgorithmPerformance(
  input: GetAlgorithmPerformanceInput,
): Promise<GetAlgorithmPerformanceOutput> {
  if (!VALID_PERIODS.includes(input.period as typeof VALID_PERIODS[number])) {
    throw new McpValidationError(
      `Invalid period: "${input.period}". Must be one of: ${VALID_PERIODS.join(', ')}`,
    );
  }

  const limit = input.limit ?? 12;
  if (limit < 1 || limit > 100) {
    throw new McpValidationError('limit must be between 1 and 100');
  }

  const pool = getPool();

  const res = await pool.query(
    `SELECT
       measured_at,
       COALESCE(hypothesis_accuracy, 0)::float AS hypothesis_accuracy,
       COALESCE(prediction_error, 0)::float AS prediction_error,
       COALESCE(improvement_rate, 0)::float AS improvement_rate
     FROM algorithm_performance
     WHERE period = $1
     ORDER BY measured_at DESC
     LIMIT $2`,
    [input.period, limit],
  );

  const data = res.rows.map((r: Record<string, unknown>) => ({
    measured_at: r['measured_at'] ? (r['measured_at'] as Date).toISOString() : '',
    hypothesis_accuracy: Number(Number(r['hypothesis_accuracy']).toFixed(4)),
    prediction_error: Number(Number(r['prediction_error']).toFixed(4)),
    improvement_rate: Number(Number(r['improvement_rate']).toFixed(4)),
  }));

  return { data };
}
