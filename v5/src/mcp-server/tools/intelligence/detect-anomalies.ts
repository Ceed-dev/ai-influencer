/**
 * MCI-009: detect_anomalies — statistical anomaly detection
 * Spec: 04-agent-design.md §4.3 #8
 */
import type {
  DetectAnomaliesInput,
  DetectAnomaliesOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PERIODS = ['7d', '30d'] as const;

function periodToInterval(period: '7d' | '30d'): string {
  return period === '7d' ? '7 days' : '30 days';
}

export async function detectAnomalies(
  input: DetectAnomaliesInput,
): Promise<DetectAnomaliesOutput> {
  if (!VALID_PERIODS.includes(input.period as typeof VALID_PERIODS[number])) {
    throw new McpValidationError(
      `Invalid period: "${input.period}". Must be one of: ${VALID_PERIODS.join(', ')}`,
    );
  }

  const threshold = input.threshold ?? 2.0;
  if (threshold <= 0) {
    throw new McpValidationError('threshold must be greater than 0');
  }

  const pool = getPool();
  const interval = periodToInterval(input.period);

  // Detect anomalies using standard deviation approach per account
  const res = await pool.query(
    `WITH account_stats AS (
       SELECT
         p.account_id,
         AVG(m.views)::float AS avg_views,
         STDDEV(m.views)::float AS stddev_views,
         AVG(m.engagement_rate)::float AS avg_engagement,
         STDDEV(m.engagement_rate)::float AS stddev_engagement
       FROM metrics m
       JOIN publications p ON p.id = m.publication_id
       WHERE m.measured_at >= NOW() - $1::interval
       GROUP BY p.account_id
       HAVING COUNT(*) >= 3
     ),
     recent_metrics AS (
       SELECT
         p.account_id,
         m.views,
         m.engagement_rate
       FROM metrics m
       JOIN publications p ON p.id = m.publication_id
       WHERE m.measured_at >= NOW() - $1::interval
     )
     SELECT
       rm.account_id,
       'views' AS metric,
       s.avg_views AS expected,
       rm.views::float AS actual,
       CASE WHEN s.stddev_views > 0
         THEN ABS(rm.views - s.avg_views) / s.stddev_views
         ELSE 0
       END AS deviation
     FROM recent_metrics rm
     JOIN account_stats s ON s.account_id = rm.account_id
     WHERE s.stddev_views > 0
       AND ABS(rm.views - s.avg_views) / s.stddev_views > $2
     UNION ALL
     SELECT
       rm.account_id,
       'engagement_rate' AS metric,
       s.avg_engagement AS expected,
       rm.engagement_rate::float AS actual,
       CASE WHEN s.stddev_engagement > 0
         THEN ABS(rm.engagement_rate - s.avg_engagement) / s.stddev_engagement
         ELSE 0
       END AS deviation
     FROM recent_metrics rm
     JOIN account_stats s ON s.account_id = rm.account_id
     WHERE s.stddev_engagement > 0
       AND ABS(rm.engagement_rate - s.avg_engagement) / s.stddev_engagement > $2
     ORDER BY deviation DESC
     LIMIT 50`,
    [interval, threshold],
  );

  return {
    anomalies: res.rows.map((r: Record<string, unknown>) => ({
      account_id: r['account_id'] as string,
      metric: r['metric'] as string,
      expected: Number(r['expected']),
      actual: Number(r['actual']),
      deviation: Number(Number(r['deviation']).toFixed(2)),
    })),
  };
}
