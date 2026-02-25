/**
 * MCI-031: create_micro_analysis
 * Spec: 04-agent-design.md §4.12 #10
 */
import type {
  CreateMicroAnalysisInput,
  CreateMicroAnalysisOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_VERDICTS = ['confirmed', 'inconclusive', 'rejected'] as const;

export async function createMicroAnalysis(
  input: CreateMicroAnalysisInput,
): Promise<CreateMicroAnalysisOutput> {
  if (!input.content_id || input.content_id.trim().length === 0) {
    throw new McpValidationError('content_id is required');
  }
  if (!VALID_VERDICTS.includes(input.micro_verdict as typeof VALID_VERDICTS[number])) {
    throw new McpValidationError(
      `Invalid micro_verdict: "${input.micro_verdict}". Must be one of: ${VALID_VERDICTS.join(', ')}`,
    );
  }

  // Calculate prediction error
  const predictedKeys = Object.keys(input.predicted_kpis);
  let totalError = 0;
  let errorCount = 0;
  for (const key of predictedKeys) {
    const predicted = input.predicted_kpis[key];
    const actual = input.actual_kpis[key];
    if (predicted !== undefined && actual !== undefined && actual !== 0) {
      totalError += Math.abs(predicted - actual) / Math.abs(actual);
      errorCount++;
    }
  }
  const predictionError = errorCount > 0 ? totalError / errorCount : 0;

  const pool = getPool();

  // Ensure the content record exists (FK requirement)
  await pool.query(
    `INSERT INTO content (content_id, content_format, status)
     VALUES ($1, 'short_video', 'measured')
     ON CONFLICT (content_id) DO NOTHING`,
    [input.content_id],
  );

  const res = await pool.query(
    `INSERT INTO content_learnings
       (content_id, hypothesis_id, predicted_kpis, actual_kpis, prediction_error,
        micro_verdict, contributing_factors, detractors, niche)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, content_id, prediction_error, micro_verdict`,
    [
      input.content_id,
      input.hypothesis_id ?? null,
      JSON.stringify(input.predicted_kpis),
      JSON.stringify(input.actual_kpis),
      predictionError,
      input.micro_verdict,
      input.contributing_factors ?? null,
      input.detractors ?? null,
      input.niche ?? null,
    ],
  );

  const row = res.rows[0] as Record<string, unknown>;
  return {
    id: row['id'] as string,
    content_id: row['content_id'] as string,
    prediction_error: Number(Number(row['prediction_error']).toFixed(4)),
    micro_verdict: row['micro_verdict'] as 'confirmed' | 'inconclusive' | 'rejected',
  };
}
