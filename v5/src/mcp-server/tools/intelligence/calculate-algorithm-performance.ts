/**
 * MCI-010: calculate_algorithm_performance
 * Spec: 04-agent-design.md §4.3 #11
 */
import type {
  CalculateAlgorithmPerformanceInput,
  CalculateAlgorithmPerformanceOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PERIODS = ['weekly', 'daily'] as const;

function periodToInterval(period: 'weekly' | 'daily'): string {
  return period === 'weekly' ? '7 days' : '1 day';
}

export async function calculateAlgorithmPerformance(
  input: CalculateAlgorithmPerformanceInput,
): Promise<CalculateAlgorithmPerformanceOutput> {
  if (!VALID_PERIODS.includes(input.period as typeof VALID_PERIODS[number])) {
    throw new McpValidationError(
      `Invalid period: "${input.period}". Must be one of: ${VALID_PERIODS.join(', ')}`,
    );
  }

  const pool = getPool();
  const interval = periodToInterval(input.period);

  // Hypothesis accuracy: ratio of confirmed hypotheses to total resolved
  const hypothesisRes = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE verdict = 'confirmed')::float AS confirmed,
       COUNT(*) FILTER (WHERE verdict IN ('confirmed', 'rejected', 'inconclusive'))::float AS total
     FROM hypotheses
     WHERE updated_at >= NOW() - $1::interval
       AND verdict != 'pending'`,
    [interval],
  );

  const hRow = hypothesisRes.rows[0] as Record<string, unknown>;
  const confirmed = Number(hRow['confirmed'] ?? 0);
  const total = Number(hRow['total'] ?? 0);
  const hypothesis_accuracy = total > 0 ? confirmed / total : 0;

  // Prediction error: average absolute error from content_learnings
  const errorRes = await pool.query(
    `SELECT COALESCE(AVG(prediction_error), 0)::float AS avg_error
     FROM content_learnings
     WHERE created_at >= NOW() - $1::interval`,
    [interval],
  );

  const prediction_error = Number(
    (errorRes.rows[0] as Record<string, unknown>)['avg_error'] ?? 0,
  );

  // Learning count
  const learningRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt
     FROM learnings
     WHERE created_at >= NOW() - $1::interval`,
    [interval],
  );

  const learning_count = Number(
    (learningRes.rows[0] as Record<string, unknown>)['cnt'] ?? 0,
  );

  // Improvement rate: compare current vs previous period
  const prevRes = await pool.query(
    `SELECT COALESCE(improvement_rate, 0)::float AS prev_rate
     FROM algorithm_performance
     WHERE period = $1
     ORDER BY measured_at DESC
     LIMIT 1`,
    [input.period],
  );

  const prevRate = Number(
    (prevRes.rows[0] as Record<string, unknown> | undefined)?.['prev_rate'] ?? 0,
  );
  const improvement_rate = hypothesis_accuracy - prevRate;

  // Insert the new record
  await pool.query(
    `INSERT INTO algorithm_performance
       (period, hypothesis_accuracy, prediction_error, learning_count, improvement_rate)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.period, hypothesis_accuracy, prediction_error, learning_count, improvement_rate],
  );

  return {
    hypothesis_accuracy: Number(hypothesis_accuracy.toFixed(4)),
    prediction_error: Number(prediction_error.toFixed(4)),
    learning_count,
    improvement_rate: Number(improvement_rate.toFixed(4)),
  };
}
