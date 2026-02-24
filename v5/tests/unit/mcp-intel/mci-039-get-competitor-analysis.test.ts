/**
 * get_competitor_analysis
 * Tests: TEST-MCP-110
 */
import { getCompetitorAnalysis } from '../../../src/mcp-server/tools/intelligence/get-competitor-analysis';
import { saveCompetitorAccount } from '../../../src/mcp-server/tools/intelligence/save-competitor-account';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM market_intel WHERE data->>'username' LIKE '%test_mci_039%'`);
  });
}

describe('get_competitor_analysis', () => {
  beforeAll(async () => {
    await cleanup();
    // Seed competitor accounts
    await saveCompetitorAccount({
      username: '@test_mci_039_user_a',
      followers: 100000,
      posting_frequency: 'daily',
      platform: 'tiktok',
    });
    await saveCompetitorAccount({
      username: '@test_mci_039_user_b',
      followers: 200000,
      posting_frequency: 'weekly',
      platform: 'tiktok',
    });
  });
  afterAll(cleanup);

  test('TEST-MCP-110: returns competitor analysis array', async () => {
    const result = await getCompetitorAnalysis({
      platform: 'tiktok',
      niche: 'beauty',
    });

    expect(result).toHaveProperty('competitors');
    expect(Array.isArray(result.competitors)).toBe(true);

    // Should contain our seeded accounts
    for (const c of result.competitors) {
      expect(c).toHaveProperty('username');
      expect(c).toHaveProperty('followers');
      expect(c).toHaveProperty('avg_views');
      expect(c).toHaveProperty('content_strategy');
      expect(typeof c.username).toBe('string');
      expect(typeof c.followers).toBe('number');
      expect(typeof c.avg_views).toBe('number');
      expect(typeof c.content_strategy).toBe('string');
    }
  });

  test('rejects invalid platform', async () => {
    await expect(
      getCompetitorAnalysis({
        platform: 'facebook' as any,
        niche: 'beauty',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty niche', async () => {
    await expect(
      getCompetitorAnalysis({
        platform: 'tiktok',
        niche: '',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns empty array for platform with no data', async () => {
    const result = await getCompetitorAnalysis({
      platform: 'instagram',
      niche: 'nonexistent_niche_mci_039',
    });

    expect(result.competitors).toEqual([]);
  });
});
