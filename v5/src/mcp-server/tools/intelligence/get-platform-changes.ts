/**
 * FEAT-MCI-005: get_platform_changes
 * Spec: 04-agent-design.md §4.2 #10
 */
import type {
  GetPlatformChangesInput,
  GetPlatformChangesOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;
const VALID_SINCE = ['30d', '90d'] as const;

function sinceToInterval(since: '30d' | '90d'): string {
  return since === '30d' ? '30 days' : '90 days';
}

export async function getPlatformChanges(
  input: GetPlatformChangesInput,
): Promise<GetPlatformChangesOutput> {
  if (!VALID_PLATFORMS.includes(input.platform as any)) {
    throw new McpValidationError(
      `Invalid platform: "${input.platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`,
    );
  }

  if (!VALID_SINCE.includes(input.since as typeof VALID_SINCE[number])) {
    throw new McpValidationError(
      `Invalid since: "${input.since}". Must be one of: ${VALID_SINCE.join(', ')}`,
    );
  }

  const pool = getPool();
  const interval = sinceToInterval(input.since);

  const res = await pool.query(
    `SELECT
       data->>'update_type' AS update_type,
       data->>'description' AS description,
       data->>'effective_date' AS effective_date
     FROM market_intel
     WHERE intel_type = 'platform_update'
       AND platform = $1
       AND collected_at >= NOW() - $2::interval
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY collected_at DESC
     LIMIT 50`,
    [input.platform, interval],
  );

  return {
    changes: res.rows.map((r: Record<string, unknown>) => ({
      update_type: (r['update_type'] as string) ?? '',
      description: (r['description'] as string) ?? '',
      effective_date: (r['effective_date'] as string) ?? '',
    })),
  };
}
