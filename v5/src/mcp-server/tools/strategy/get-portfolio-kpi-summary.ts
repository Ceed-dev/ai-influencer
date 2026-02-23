/**
 * FEAT-MCC-001: get_portfolio_kpi_summary
 * Spec: 04-agent-design.md §4.1 #1
 * Returns KPI summary across all accounts for a given period.
 */
import type {
  GetPortfolioKpiSummaryInput,
  GetPortfolioKpiSummaryOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PERIODS = ['7d', '30d'] as const;

function periodToInterval(period: '7d' | '30d'): string {
  return period === '7d' ? '7 days' : '30 days';
}

export async function getPortfolioKpiSummary(
  input: GetPortfolioKpiSummaryInput,
): Promise<GetPortfolioKpiSummaryOutput> {
  if (!VALID_PERIODS.includes(input.period as any)) {
    throw new McpValidationError(
      `Invalid period: "${input.period}". Must be one of: ${VALID_PERIODS.join(', ')}`,
    );
  }

  const pool = getPool();
  const interval = periodToInterval(input.period);

  // Total and active accounts
  const accountsRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total_accounts,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active_accounts,
      COUNT(*) FILTER (WHERE monetization_status = 'active')::int AS monetized_count
    FROM accounts
  `);

  const { total_accounts, active_accounts, monetized_count } = accountsRes.rows[0] ?? {
    total_accounts: 0,
    active_accounts: 0,
    monetized_count: 0,
  };

  // Views and engagement from metrics within the period
  const metricsRes = await pool.query(
    `
    SELECT
      COALESCE(SUM(m.views), 0)::int AS total_views,
      COALESCE(AVG(m.engagement_rate), 0)::float AS avg_engagement_rate,
      COALESCE(SUM(m.follower_delta), 0)::int AS follower_growth
    FROM metrics m
    JOIN publications p ON p.id = m.publication_id
    WHERE m.measured_at >= NOW() - $1::interval
    `,
    [interval],
  );

  const { total_views, avg_engagement_rate, follower_growth } = metricsRes.rows[0] ?? {
    total_views: 0,
    avg_engagement_rate: 0,
    follower_growth: 0,
  };

  return {
    total_accounts,
    active_accounts,
    total_views,
    avg_engagement_rate: Number(Number(avg_engagement_rate).toFixed(4)),
    follower_growth,
    monetized_count,
  };
}
