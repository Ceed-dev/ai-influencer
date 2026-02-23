/**
 * FEAT-MCC-002: get_cluster_performance
 * Spec: 04-agent-design.md §4.1 #2
 * Returns cluster-level performance comparison for a given period.
 */
import type {
  GetClusterPerformanceInput,
  GetClusterPerformanceOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PERIODS = ['7d'] as const;

export async function getClusterPerformance(
  input: GetClusterPerformanceInput,
): Promise<GetClusterPerformanceOutput> {
  if (!VALID_PERIODS.includes(input.period as any)) {
    throw new McpValidationError(
      `Invalid period: "${input.period}". Must be one of: ${VALID_PERIODS.join(', ')}`,
    );
  }

  const pool = getPool();

  const res = await pool.query(`
    SELECT
      a.cluster,
      COUNT(DISTINCT a.account_id)::int AS account_count,
      COALESCE(AVG(m.views), 0)::float AS avg_views,
      COALESCE(AVG(m.engagement_rate), 0)::float AS avg_engagement
    FROM accounts a
    LEFT JOIN publications p ON p.account_id = a.account_id
    LEFT JOIN metrics m ON m.publication_id = p.id
      AND m.measured_at >= NOW() - INTERVAL '7 days'
    WHERE a.cluster IS NOT NULL
    GROUP BY a.cluster
    ORDER BY a.cluster
  `);

  const clusters = res.rows.map((row: Record<string, unknown>) => ({
    cluster: String(row['cluster'] ?? ''),
    account_count: Number(row['account_count'] ?? 0),
    avg_views: Number(Number(row['avg_views'] ?? 0).toFixed(2)),
    avg_engagement: Number(Number(row['avg_engagement'] ?? 0).toFixed(4)),
  }));

  return { clusters };
}
