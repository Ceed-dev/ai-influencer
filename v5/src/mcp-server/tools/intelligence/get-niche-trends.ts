/**
 * MCI-005: get_niche_trends — aggregation + mark_intel_expired
 * Spec: 04-agent-design.md §4.2 #8
 */
import type {
  GetNicheTrendsInput,
  GetNicheTrendsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PERIODS = ['7d', '30d'] as const;

function periodToInterval(period: '7d' | '30d'): string {
  return period === '7d' ? '7 days' : '30 days';
}

export async function getNicheTrends(
  input: GetNicheTrendsInput,
): Promise<GetNicheTrendsOutput> {
  if (!input.niche || input.niche.trim().length === 0) {
    throw new McpValidationError('niche is required and must not be empty');
  }
  if (!VALID_PERIODS.includes(input.period as typeof VALID_PERIODS[number])) {
    throw new McpValidationError(
      `Invalid period: "${input.period}". Must be one of: ${VALID_PERIODS.join(', ')}`,
    );
  }

  const pool = getPool();
  const interval = periodToInterval(input.period);

  // Mark expired intel
  await pool.query(
    `UPDATE market_intel SET expires_at = NOW()
     WHERE niche = $1 AND intel_type = 'trending_topic'
       AND collected_at < NOW() - $2::interval
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [input.niche, interval],
  );

  // Aggregate trends
  const res = await pool.query(
    `SELECT
       data->>'topic' AS topic,
       COALESCE((data->>'volume')::int, 0) AS volume,
       CASE
         WHEN COALESCE((data->>'growth_rate')::float, 0) > 0.05 THEN 'rising'
         WHEN COALESCE((data->>'growth_rate')::float, 0) < -0.05 THEN 'declining'
         ELSE 'stable'
       END AS trend_direction
     FROM market_intel
     WHERE niche = $1
       AND intel_type = 'trending_topic'
       AND collected_at >= NOW() - $2::interval
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY COALESCE((data->>'volume')::int, 0) DESC
     LIMIT 50`,
    [input.niche, interval],
  );

  return {
    trends: res.rows.map((r: Record<string, unknown>) => ({
      topic: (r['topic'] as string) ?? '',
      volume: Number(r['volume']),
      trend_direction: r['trend_direction'] as 'rising' | 'stable' | 'declining',
    })),
  };
}
