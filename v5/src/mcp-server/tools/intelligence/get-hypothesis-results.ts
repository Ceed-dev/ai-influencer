/**
 * MCI-036: get_hypothesis_results
 * Spec: 04-agent-design.md §4.3 #2
 *
 * Joins hypotheses, content, publications, metrics to get predicted vs actual data
 * for a specific hypothesis.
 */
import type {
  GetHypothesisResultsInput,
  GetHypothesisResultsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

export async function getHypothesisResults(
  input: GetHypothesisResultsInput,
): Promise<GetHypothesisResultsOutput> {
  if (!input.hypothesis_id || typeof input.hypothesis_id !== 'number') {
    throw new McpValidationError('hypothesis_id is required and must be a number');
  }

  const pool = getPool();

  // Get hypothesis predicted/actual KPIs
  const hRes = await pool.query(
    `SELECT predicted_kpis, actual_kpis
     FROM hypotheses
     WHERE id = $1`,
    [input.hypothesis_id],
  );

  if (hRes.rows.length === 0) {
    throw new McpNotFoundError(`Hypothesis not found: ${input.hypothesis_id}`);
  }

  const hRow = hRes.rows[0] as Record<string, unknown>;
  const predicted_kpis = (hRow['predicted_kpis'] as Record<string, number>) ?? {};
  const actual_kpis = (hRow['actual_kpis'] as Record<string, number>) ?? {};

  // Count content linked to this hypothesis
  const contentRes = await pool.query(
    `SELECT COUNT(*)::int AS content_count
     FROM content
     WHERE hypothesis_id = $1`,
    [input.hypothesis_id],
  );
  const content_count = Number(
    (contentRes.rows[0] as Record<string, unknown>)['content_count'] ?? 0,
  );

  // Get raw metrics for content linked to this hypothesis
  const metricsRes = await pool.query(
    `SELECT
       m.id AS metric_id,
       p.id AS publication_id,
       c.content_id,
       p.platform,
       COALESCE(m.views, 0)::int AS views,
       COALESCE(m.likes, 0)::int AS likes,
       COALESCE(m.comments, 0)::int AS comments,
       COALESCE(m.shares, 0)::int AS shares,
       COALESCE(m.engagement_rate, 0)::float AS engagement_rate,
       COALESCE(m.completion_rate, 0)::float AS completion_rate,
       COALESCE(m.impressions, 0)::int AS impressions,
       m.measurement_point,
       m.measured_at
     FROM content c
     JOIN publications p ON p.content_id = c.content_id
     JOIN metrics m ON m.publication_id = p.id
     WHERE c.hypothesis_id = $1
     ORDER BY m.measured_at DESC`,
    [input.hypothesis_id],
  );

  const raw_metrics = metricsRes.rows.map((r: Record<string, unknown>) => ({
    metric_id: r['metric_id'] as number,
    publication_id: r['publication_id'] as number,
    content_id: r['content_id'] as string,
    platform: r['platform'] as string,
    views: Number(r['views']),
    likes: Number(r['likes']),
    comments: Number(r['comments']),
    shares: Number(r['shares']),
    engagement_rate: Number(Number(r['engagement_rate']).toFixed(4)),
    completion_rate: Number(Number(r['completion_rate']).toFixed(4)),
    impressions: Number(r['impressions']),
    measurement_point: r['measurement_point'] as string | null,
    measured_at: r['measured_at'] ? (r['measured_at'] as Date).toISOString() : '',
  }));

  return {
    predicted_kpis,
    actual_kpis,
    content_count,
    raw_metrics,
  };
}
