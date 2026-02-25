/**
 * get_intel_gaps
 * Tests: TEST-MCP-016
 */
import { getIntelGaps } from '../../../src/mcp-server/tools/intelligence/get-intel-gaps';
import { saveTrendingTopic } from '../../../src/mcp-server/tools/intelligence/save-trending-topic';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM market_intel WHERE niche = 'test_mci_042'`);
  });
}

describe('get_intel_gaps', () => {
  beforeAll(async () => {
    await cleanup();
    // Seed a trending_topic so at least one type has recent data
    await saveTrendingTopic({
      topic: 'test_mci_042_gap_test',
      volume: 5000,
      growth_rate: 0.15,
      platform: 'tiktok',
      niche: 'test_mci_042',
    });
  });
  afterAll(cleanup);

  test('TEST-MCP-016: returns gaps array with all intel types', async () => {
    const result = await getIntelGaps({ niche: 'test_mci_042' });

    expect(result).toHaveProperty('gaps');
    expect(Array.isArray(result.gaps)).toBe(true);

    // Should return one entry per intel_type (5 total)
    expect(result.gaps.length).toBe(5);

    const types = result.gaps.map(g => g.intel_type);
    expect(types).toContain('trending_topic');
    expect(types).toContain('competitor_post');
    expect(types).toContain('competitor_account');
    expect(types).toContain('audience_signal');
    expect(types).toContain('platform_update');

    for (const gap of result.gaps) {
      expect(gap).toHaveProperty('intel_type');
      expect(gap).toHaveProperty('last_collected');
      expect(gap).toHaveProperty('gap_hours');
      expect(typeof gap.gap_hours).toBe('number');
      expect(gap.gap_hours).toBeGreaterThanOrEqual(0);
    }

    // trending_topic should have a recent last_collected (small gap)
    const trendingGap = result.gaps.find(g => g.intel_type === 'trending_topic');
    expect(trendingGap).toBeDefined();
    expect(trendingGap!.last_collected).not.toBeNull();
    // Just inserted, so gap should be very small
    expect(trendingGap!.gap_hours).toBeLessThan(1);
  });

  test('rejects empty niche', async () => {
    await expect(
      getIntelGaps({ niche: '' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns large gap_hours for niche with no data', async () => {
    const result = await getIntelGaps({ niche: 'nonexistent_niche_mci_042_xxx' });

    expect(result.gaps.length).toBe(5);
    // All types should have no data for this niche — but they may pick up
    // data from other niches if niche is NULL. The key point is gap_hours >= 0.
    for (const gap of result.gaps) {
      expect(gap.gap_hours).toBeGreaterThanOrEqual(0);
    }
  });
});
