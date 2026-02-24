/**
 * MCI-042: run_weight_recalculation
 * Tests: weight recalculation batch wrapper
 */
import { runWeightRecalculation } from '../../../src/mcp-server/tools/intelligence/run-weight-recalculation';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-042: run_weight_recalculation', () => {
  test('rejects invalid platform', async () => {
    await expect(
      runWeightRecalculation({ platform: 'facebook' as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns correct structure for valid platform', async () => {
    const result = await runWeightRecalculation({ platform: 'tiktok' });
    expect(result).toHaveProperty('factors');
    expect(result).toHaveProperty('data_count');
    expect(result).toHaveProperty('skipped_reason');
    expect(Array.isArray(result.factors)).toBe(true);
    expect(typeof result.data_count).toBe('number');

    // Either performed (has factors) or skipped (has reason)
    if (result.skipped_reason !== null) {
      expect(typeof result.skipped_reason).toBe('string');
      expect(result.factors).toHaveLength(0);
    } else {
      for (const factor of result.factors) {
        expect(factor).toHaveProperty('name');
        expect(factor).toHaveProperty('old_weight');
        expect(factor).toHaveProperty('new_weight');
        expect(typeof factor.name).toBe('string');
        expect(typeof factor.old_weight).toBe('number');
        expect(typeof factor.new_weight).toBe('number');
      }
    }
  });

  test('accepts all valid platforms', async () => {
    for (const platform of ['youtube', 'tiktok', 'instagram', 'x'] as const) {
      const result = await runWeightRecalculation({ platform });
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('data_count');
    }
  });
});
