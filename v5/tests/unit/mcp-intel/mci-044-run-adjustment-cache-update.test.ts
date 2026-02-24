/**
 * MCI-044: run_adjustment_cache_update
 * Tests: adjustment factor cache update batch wrapper
 */
import { runAdjustmentCacheUpdate } from '../../../src/mcp-server/tools/intelligence/run-adjustment-cache-update';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-044: run_adjustment_cache_update', () => {
  test('rejects invalid platform', async () => {
    await expect(
      runAdjustmentCacheUpdate({ platform: 'facebook' as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns correct structure for valid platform', async () => {
    const result = await runAdjustmentCacheUpdate({ platform: 'tiktok' });
    expect(result).toHaveProperty('factors_updated');
    expect(result).toHaveProperty('cache_entries');
    expect(typeof result.factors_updated).toBe('number');
    expect(typeof result.cache_entries).toBe('number');
    expect(result.factors_updated).toBeGreaterThanOrEqual(0);
    expect(result.cache_entries).toBeGreaterThanOrEqual(0);
  });

  test('accepts all valid platforms', async () => {
    for (const platform of ['youtube', 'tiktok', 'instagram', 'x'] as const) {
      const result = await runAdjustmentCacheUpdate({ platform });
      expect(result).toHaveProperty('factors_updated');
    }
  });
});
