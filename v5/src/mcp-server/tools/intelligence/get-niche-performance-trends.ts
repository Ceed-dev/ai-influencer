/**
 * MCI-039: get_niche_performance_trends
 * Spec: 04-agent-design.md §4.3 #12
 *
 * Aggregates metrics by date for a specific niche over a given period.
 */
import type {
  GetNichePerformanceTrendsInput,
  GetNichePerformanceTrendsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PERIODS = ['7d', '30d', '90d'] as const;

function periodToInterval(period: '7d' | '30d' | '90d'): string {
  switch (period) {
    case '7d': return '7 days';
    case '30d': return '30 days';
    case '90d': return '90 days';
  }
}

export async function getNichePerformanceTrends(
  input: GetNichePerformanceTrendsInput,
): Promise<GetNichePerformanceTrendsOutput> {
  if (!VALID_PERIODS.includes(input.period as typeof VALID_PERIODS[number])) {
    throw new McpValidationError(
      `Invalid period: "${input.period}". Must be one of: ${VALID_PERIODS.join(', ')}`,
    );
  }
  if (!input.niche || input.niche.trim().length === 0) {
    throw new McpValidationError('niche is required');
  }

  const pool = getPool();
  const interval = periodToInterval(input.period);

  const res = await pool.query(
    `SELECT
       DATE(m.measured_at) AS date,
       COALESCE(AVG(m.views), 0)::float AS avg_views,
       COALESCE(AVG(m.engagement_rate), 0)::float AS avg_engagement,
       COUNT(DISTINCT c.content_id)::int AS content_count
     FROM metrics m
     JOIN publications p ON m.publication_id = p.id
     JOIN accounts a ON p.account_id = a.account_id
     JOIN content c ON p.content_id = c.content_id
     WHERE a.niche = $1
       AND m.measured_at >= NOW() - $2::interval
     GROUP BY DATE(m.measured_at)
     ORDER BY DATE(m.measured_at) ASC`,
    [input.niche, interval],
  );

  const data = res.rows.map((r: Record<string, unknown>) => ({
    date: r['date'] ? (r['date'] as Date).toISOString().split('T')[0]! : '',
    avg_views: Number(Number(r['avg_views']).toFixed(2)),
    avg_engagement: Number(Number(r['avg_engagement']).toFixed(4)),
    content_count: Number(r['content_count']),
  }));

  return { data };
}
