/**
 * MCI-034: get_content_prediction
 * Spec: 04-agent-design.md §4.12 #13 / §4.3 #15
 */
import type {
  GetContentPredictionInput,
  GetContentPredictionOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function getContentPrediction(
  input: GetContentPredictionInput,
): Promise<GetContentPredictionOutput> {
  if (!input.content_id || input.content_id.trim().length === 0) {
    throw new McpValidationError('content_id is required');
  }

  const pool = getPool();

  // Get hypothesis data via content
  const contentRes = await pool.query(
    `SELECT c.content_id, c.hypothesis_id, h.predicted_kpis, h.category
     FROM content c
     LEFT JOIN hypotheses h ON h.id = c.hypothesis_id
     WHERE c.content_id = $1`,
    [input.content_id],
  );

  if (contentRes.rowCount === 0) {
    return {
      content_id: input.content_id,
      hypothesis_id: null,
      predicted_kpis: null,
      hypothesis_category: null,
      baseline_used: null,
      baseline_source: null,
      adjustments_applied: null,
      total_adjustment: null,
      predicted_impressions: null,
    };
  }

  const row = contentRes.rows[0] as Record<string, unknown>;
  const hypothesisId = row['hypothesis_id'] as number | null;

  // Get prediction snapshot data if available
  const snapRes = await pool.query(
    `SELECT baseline_used, baseline_source, adjustments_applied,
            total_adjustment, predicted_impressions
     FROM prediction_snapshots
     WHERE content_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.content_id],
  );

  const snap = snapRes.rows[0] as Record<string, unknown> | undefined;

  return {
    content_id: input.content_id,
    hypothesis_id: hypothesisId,
    predicted_kpis: (row['predicted_kpis'] as Record<string, number> | null) ?? null,
    hypothesis_category: (row['category'] as string | null) ?? null,
    baseline_used: snap ? (snap['baseline_used'] as number) : null,
    baseline_source: snap ? (snap['baseline_source'] as string) : null,
    adjustments_applied: snap
      ? (snap['adjustments_applied'] as Record<string, { value: string; adjustment: number; weight: number }>)
      : null,
    total_adjustment: snap ? (snap['total_adjustment'] as number) : null,
    predicted_impressions: snap ? (snap['predicted_impressions'] as number) : null,
  };
}
