/**
 * MCI-005: get_niche_trends
 * Tests: aggregation + mark_intel_expired
 */
import { getNicheTrends } from '../../../src/mcp-server/tools/intelligence/get-niche-trends';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-005: get_niche_trends', () => {
  test('rejects empty niche', async () => {
    await expect(
      getNicheTrends({ niche: '', period: '7d' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects invalid period', async () => {
    await expect(
      getNicheTrends({ niche: 'beauty', period: '90d' as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns trends array', async () => {
    const result = await getNicheTrends({ niche: 'beauty', period: '7d' });
    expect(result).toHaveProperty('trends');
    expect(Array.isArray(result.trends)).toBe(true);
  });
});
