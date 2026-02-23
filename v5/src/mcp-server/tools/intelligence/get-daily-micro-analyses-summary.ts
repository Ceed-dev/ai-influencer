/**
 * MCI-035: get_daily_micro_analyses_summary
 * Spec: 04-agent-design.md §4.12 #14 / §4.3 #17
 */
import type {
  GetDailyMicroAnalysesSummaryInput,
  GetDailyMicroAnalysesSummaryOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';

export async function getDailyMicroAnalysesSummary(
  input: GetDailyMicroAnalysesSummaryInput,
): Promise<GetDailyMicroAnalysesSummaryOutput> {
  const targetDate = input.date ?? new Date().toISOString().split('T')[0]!;

  const pool = getPool();

  const conditions: string[] = [`created_at::date = $1::date`];
  const params: unknown[] = [targetDate];
  let paramIdx = 2;

  if (input.niche) {
    conditions.push(`niche = $${paramIdx++}`);
    params.push(input.niche);
  }

  const res = await pool.query(
    `SELECT
       COUNT(*)::int AS total_analyses,
       COUNT(*) FILTER (WHERE micro_verdict = 'confirmed')::int AS confirmed,
       COUNT(*) FILTER (WHERE micro_verdict = 'inconclusive')::int AS inconclusive,
       COUNT(*) FILTER (WHERE micro_verdict = 'rejected')::int AS rejected,
       COALESCE(AVG(prediction_error), 0)::float AS avg_prediction_error,
       COUNT(*) FILTER (WHERE promoted_to_learning_id IS NOT NULL)::int AS promoted_count
     FROM content_learnings
     WHERE ${conditions.join(' AND ')}`,
    params,
  );

  const row = res.rows[0] as Record<string, unknown>;

  // Get top insights
  const insightConditions = [...conditions];
  const insightParams = [...params];
  insightParams.push(5);

  const insightsRes = await pool.query(
    `SELECT key_insight
     FROM content_learnings
     WHERE ${insightConditions.join(' AND ')}
       AND key_insight IS NOT NULL
     ORDER BY confidence DESC
     LIMIT $${paramIdx}`,
    insightParams,
  );

  return {
    date: targetDate,
    total_analyses: row['total_analyses'] as number,
    confirmed: row['confirmed'] as number,
    inconclusive: row['inconclusive'] as number,
    rejected: row['rejected'] as number,
    avg_prediction_error: Number(Number(row['avg_prediction_error']).toFixed(4)),
    top_insights: insightsRes.rows.map(
      (r: Record<string, unknown>) => r['key_insight'] as string,
    ),
    promoted_count: row['promoted_count'] as number,
  };
}
