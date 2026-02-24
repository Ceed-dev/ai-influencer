/**
 * FEAT-MCI-005: get_intel_gaps
 * Spec: 04-agent-design.md §4.2 #12
 */
import type {
  GetIntelGapsInput,
  GetIntelGapsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const ALL_INTEL_TYPES = [
  'trending_topic',
  'competitor_post',
  'competitor_account',
  'audience_signal',
  'platform_update',
] as const;

export async function getIntelGaps(
  input: GetIntelGapsInput,
): Promise<GetIntelGapsOutput> {
  if (!input.niche || input.niche.trim().length === 0) {
    throw new McpValidationError('niche is required and must not be empty');
  }

  const pool = getPool();

  // For each intel_type, find the most recent collected_at and calculate gap_hours
  // Use a LEFT JOIN with all known intel_types to ensure we return gaps even when
  // there is no data at all (gap_hours will be very large).
  const res = await pool.query(
    `SELECT
       t.intel_type,
       MAX(m.collected_at) AS last_collected,
       CASE
         WHEN MAX(m.collected_at) IS NULL THEN 999999
         ELSE EXTRACT(EPOCH FROM (NOW() - MAX(m.collected_at))) / 3600
       END AS gap_hours
     FROM unnest($1::text[]) AS t(intel_type)
     LEFT JOIN market_intel m
       ON m.intel_type = t.intel_type
       AND (m.niche = $2 OR m.niche IS NULL)
       AND (m.expires_at IS NULL OR m.expires_at > NOW())
     GROUP BY t.intel_type
     ORDER BY gap_hours DESC`,
    [ALL_INTEL_TYPES as unknown as string[], input.niche],
  );

  return {
    gaps: res.rows.map((r: Record<string, unknown>) => ({
      intel_type: r['intel_type'] as GetIntelGapsOutput['gaps'][number]['intel_type'],
      last_collected: r['last_collected']
        ? (r['last_collected'] as Date).toISOString()
        : null,
      gap_hours: Math.round(Number(r['gap_hours'])),
    })),
  };
}
