/**
 * MCI-039: get_niche_performance_trends
 * Tests: niche performance trend aggregation
 */
import { getNichePerformanceTrends } from '../../../src/mcp-server/tools/intelligence/get-niche-performance-trends';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-039: get_niche_performance_trends', () => {
  test('rejects invalid period', async () => {
    await expect(
      getNichePerformanceTrends({ niche: 'beauty', period: '1d' as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty niche', async () => {
    await expect(
      getNichePerformanceTrends({ niche: '', period: '30d' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns data array with required fields', async () => {
    const result = await getNichePerformanceTrends({ niche: 'beauty', period: '30d' });
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);

    for (const entry of result.data) {
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('avg_views');
      expect(entry).toHaveProperty('avg_engagement');
      expect(entry).toHaveProperty('content_count');
      expect(typeof entry.date).toBe('string');
      expect(typeof entry.avg_views).toBe('number');
      expect(typeof entry.avg_engagement).toBe('number');
      expect(typeof entry.content_count).toBe('number');
    }
  });

  test('accepts all valid periods', async () => {
    for (const period of ['7d', '30d', '90d'] as const) {
      const result = await getNichePerformanceTrends({ niche: 'tech', period });
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    }
  });
});
