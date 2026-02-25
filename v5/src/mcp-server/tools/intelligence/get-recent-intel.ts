/**
 * FEAT-MCI-003: get_recent_intel — filtering by intel_type, platform, limit
 * Spec: 04-agent-design.md §4.2 #6
 */
import type {
  GetRecentIntelInput,
  GetRecentIntelOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_INTEL_TYPES = ['trending_topic', 'competitor_post', 'competitor_account', 'audience_signal', 'platform_update'] as const;
const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;

export async function getRecentIntel(
  input: GetRecentIntelInput,
): Promise<GetRecentIntelOutput> {
  if (input.intel_type && !VALID_INTEL_TYPES.includes(input.intel_type as any)) {
    throw new McpValidationError(
      `Invalid intel_type: "${input.intel_type}". Must be one of: ${VALID_INTEL_TYPES.join(', ')}`,
    );
  }
  if (input.platform && !VALID_PLATFORMS.includes(input.platform as any)) {
    throw new McpValidationError(
      `Invalid platform: "${input.platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`,
    );
  }

  const limit = input.limit ?? 20;
  const pool = getPool();

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (input.intel_type) {
    conditions.push(`intel_type = $${paramIdx++}`);
    params.push(input.intel_type);
  }
  if (input.platform) {
    conditions.push(`platform = $${paramIdx++}`);
    params.push(input.platform);
  }
  // Exclude expired
  conditions.push(`(expires_at IS NULL OR expires_at > NOW())`);

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit);
  const res = await pool.query(
    `SELECT id, data, COALESCE(relevance_score, 0)::float AS relevance_score, collected_at
     FROM market_intel
     ${where}
     ORDER BY collected_at DESC
     LIMIT $${paramIdx}`,
    params,
  );

  return {
    intel: res.rows.map((r: any) => ({
      id: r.id,
      data: r.data,
      relevance_score: Number(r.relevance_score),
      collected_at: r.collected_at.toISOString(),
    })),
  };
}
