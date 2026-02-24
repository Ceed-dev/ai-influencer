/**
 * FEAT-MCC-008: get_account_performance
 * Spec: 04-agent-design.md S4.4 #2
 * Returns performance summary for a specific account over a given period.
 */
import type {
  GetAccountPerformanceInput,
  GetAccountPerformanceOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

const VALID_PERIODS = ['7d', '30d'] as const;

function periodToInterval(period: '7d' | '30d'): string {
  return period === '7d' ? '7 days' : '30 days';
}

export async function getAccountPerformance(
  input: GetAccountPerformanceInput,
): Promise<GetAccountPerformanceOutput> {
  if (!input.account_id || input.account_id.trim().length === 0) {
    throw new McpValidationError('account_id is required');
  }
  if (!VALID_PERIODS.includes(input.period as typeof VALID_PERIODS[number])) {
    throw new McpValidationError(
      `Invalid period: "${input.period}". Must be one of: ${VALID_PERIODS.join(', ')}`,
    );
  }

  const pool = getPool();
  const interval = periodToInterval(input.period);

  // Check account exists
  const accountRes = await pool.query(
    `SELECT account_id FROM accounts WHERE account_id = $1`,
    [input.account_id],
  );
  if (accountRes.rowCount === 0) {
    throw new McpNotFoundError(`Account "${input.account_id}" not found`);
  }

  // Get average views and engagement for the period
  const metricsRes = await pool.query(
    `SELECT
       COALESCE(AVG(m.views), 0)::float AS avg_views,
       COALESCE(AVG(m.engagement_rate), 0)::float AS avg_engagement
     FROM metrics m
     JOIN publications p ON p.id = m.publication_id
     WHERE p.account_id = $1
       AND m.measured_at >= NOW() - $2::interval`,
    [input.account_id, interval],
  );

  const { avg_views, avg_engagement } = metricsRes.rows[0] as Record<string, number>;

  // Get top content by views
  const topRes = await pool.query(
    `SELECT p.content_id, COALESCE(m.views, 0) AS views
     FROM publications p
     JOIN metrics m ON m.publication_id = p.id
     WHERE p.account_id = $1
       AND m.measured_at >= NOW() - $2::interval
     ORDER BY m.views DESC NULLS LAST
     LIMIT 1`,
    [input.account_id, interval],
  );

  const topContent = topRes.rowCount !== null && topRes.rowCount > 0
    ? (topRes.rows[0] as Record<string, unknown>)['content_id'] as string
    : '';

  // Determine trend by comparing recent half vs older half
  const halfInterval = input.period === '7d' ? '3 days' : '15 days';
  const trendRes = await pool.query(
    `SELECT
       COALESCE(AVG(CASE WHEN m.measured_at >= NOW() - $2::interval THEN m.views END), 0)::float AS recent_avg,
       COALESCE(AVG(CASE WHEN m.measured_at < NOW() - $2::interval AND m.measured_at >= NOW() - $3::interval THEN m.views END), 0)::float AS older_avg
     FROM metrics m
     JOIN publications p ON p.id = m.publication_id
     WHERE p.account_id = $1
       AND m.measured_at >= NOW() - $3::interval`,
    [input.account_id, halfInterval, interval],
  );

  const trendRow = trendRes.rows[0] as Record<string, number> | undefined;
  const recent_avg = trendRow?.['recent_avg'] ?? 0;
  const older_avg = trendRow?.['older_avg'] ?? 0;
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (older_avg > 0) {
    const ratio = recent_avg / older_avg;
    if (ratio > 1.1) trend = 'improving';
    else if (ratio < 0.9) trend = 'declining';
  }

  return {
    avg_views: Math.round(avg_views ?? 0),
    avg_engagement: Number(Number(avg_engagement ?? 0).toFixed(4)),
    top_content: topContent,
    trend,
  };
}
