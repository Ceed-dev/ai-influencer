/**
 * FEAT-MCC-032: get_dashboard_summary
 * Spec: 04-agent-design.md §4.9 #1
 * Composes dashboard summary from portfolio KPI data + pending items.
 */
import type {
  GetDashboardSummaryInput,
  GetDashboardSummaryOutput,
  GetPortfolioKpiSummaryOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';

export async function getDashboardSummary(
  _input: GetDashboardSummaryInput,
): Promise<GetDashboardSummaryOutput> {
  const pool = getPool();

  // Portfolio KPI (7d default)
  const accountsRes = await pool.query(`
    SELECT
      COUNT(*)::int AS total_accounts,
      COUNT(*) FILTER (WHERE status = 'active')::int AS active_accounts,
      COUNT(*) FILTER (WHERE monetization_status = 'active')::int AS monetized_count
    FROM accounts
  `);

  const accountsRow = accountsRes.rows[0] ?? {
    total_accounts: 0,
    active_accounts: 0,
    monetized_count: 0,
  };

  const metricsRes = await pool.query(`
    SELECT
      COALESCE(SUM(m.views), 0)::int AS total_views,
      COALESCE(AVG(m.engagement_rate), 0)::float AS avg_engagement_rate,
      COALESCE(SUM(m.follower_delta), 0)::int AS follower_growth
    FROM metrics m
    JOIN publications p ON p.id = m.publication_id
    WHERE m.measured_at >= NOW() - INTERVAL '7 days'
  `);

  const metricsRow = metricsRes.rows[0] ?? {
    total_views: 0,
    avg_engagement_rate: 0,
    follower_growth: 0,
  };

  const kpi: GetPortfolioKpiSummaryOutput = {
    total_accounts: accountsRow.total_accounts as number,
    active_accounts: accountsRow.active_accounts as number,
    total_views: metricsRow.total_views as number,
    avg_engagement_rate: Number(Number(metricsRow.avg_engagement_rate).toFixed(4)),
    follower_growth: metricsRow.follower_growth as number,
    monetized_count: accountsRow.monetized_count as number,
  };

  // Algorithm accuracy (latest weekly)
  const algoRes = await pool.query(`
    SELECT hypothesis_accuracy
    FROM algorithm_performance
    WHERE period = 'weekly'
    ORDER BY measured_at DESC
    LIMIT 1
  `);
  const algoRow = algoRes.rows[0] as { hypothesis_accuracy: number | null } | undefined;
  const algorithmAccuracy = algoRow?.hypothesis_accuracy ?? 0;

  // Active cycles
  const cyclesRes = await pool.query(`
    SELECT COUNT(*)::int AS active_cycles
    FROM cycles
    WHERE status NOT IN ('completed')
  `);
  const cyclesRow = cyclesRes.rows[0] as { active_cycles: number } | undefined;
  const activeCycles = cyclesRow?.active_cycles ?? 0;

  // Pending tasks
  const tasksRes = await pool.query(`
    SELECT COUNT(*)::int AS pending_tasks
    FROM task_queue
    WHERE status IN ('pending', 'queued')
  `);
  const tasksRow = tasksRes.rows[0] as { pending_tasks: number } | undefined;
  const pendingTasks = tasksRow?.pending_tasks ?? 0;

  return {
    kpi,
    algorithm_accuracy: Number(Number(algorithmAccuracy).toFixed(4)),
    active_cycles: activeCycles,
    pending_tasks: pendingTasks,
  };
}
