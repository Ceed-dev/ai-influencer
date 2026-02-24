/**
 * MCI-044: run_adjustment_cache_update
 * Spec: 04-agent-design.md §4.3 #20
 *
 * Wraps src/workers/algorithm/adjustment-cache.ts updateAdjustmentCacheForPlatform.
 * Computes 8 adjustment factors per platform and UPSERTs into adjustment_factor_cache.
 */
import type {
  RunAdjustmentCacheUpdateInput,
  RunAdjustmentCacheUpdateOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';
import { updateAdjustmentCacheForPlatform } from '../../../workers/algorithm/adjustment-cache.js';

const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;

export async function runAdjustmentCacheUpdate(
  input: RunAdjustmentCacheUpdateInput,
): Promise<RunAdjustmentCacheUpdateOutput> {
  if (!VALID_PLATFORMS.includes(input.platform as typeof VALID_PLATFORMS[number])) {
    throw new McpValidationError(
      `Invalid platform: "${input.platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`,
    );
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await updateAdjustmentCacheForPlatform(input.platform, client);

    const factorNames = Object.keys(result.factorCounts);
    const cacheEntries = Object.values(result.factorCounts).reduce((a, b) => a + b, 0);

    return {
      factors_updated: factorNames.length,
      cache_entries: cacheEntries,
    };
  } finally {
    client.release();
  }
}
