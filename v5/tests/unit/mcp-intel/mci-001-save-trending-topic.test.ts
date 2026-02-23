/**
 * FEAT-MCI-001: save_trending_topic
 * Tests: TEST-MCP-011, TEST-MCP-092
 */
import { saveTrendingTopic } from '../../../src/mcp-server/tools/intelligence/save-trending-topic';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM market_intel WHERE niche = 'test_mci_001'`);
  });
}

describe('FEAT-MCI-001: save_trending_topic', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  test('TEST-MCP-011: saves trending topic and returns id', async () => {
    const result = await saveTrendingTopic({
      topic: 'glass skin',
      volume: 50000,
      growth_rate: 0.25,
      platform: 'tiktok',
      niche: 'test_mci_001',
    });

    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('number');
    expect(result.id).toBeGreaterThan(0);

    const dbCheck = await withClient(async (client) => {
      const res = await client.query(
        `SELECT intel_type, platform, niche, data FROM market_intel WHERE id = $1`,
        [result.id],
      );
      return res.rows[0];
    });

    expect(dbCheck).toBeDefined();
    expect(dbCheck.intel_type).toBe('trending_topic');
    expect(dbCheck.platform).toBe('tiktok');
    expect(dbCheck.niche).toBe('test_mci_001');
    expect(dbCheck.data.topic).toBe('glass skin');
  });

  test('TEST-MCP-092: rejects invalid platform', async () => {
    await expect(
      saveTrendingTopic({
        topic: 'test',
        volume: 100,
        growth_rate: 0.1,
        platform: 'facebook' as any,
        niche: 'test_mci_001',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-092: accepts all valid platforms', async () => {
    for (const platform of ['youtube', 'tiktok', 'instagram', 'x'] as const) {
      const result = await saveTrendingTopic({
        topic: `test_${platform}`,
        volume: 100,
        growth_rate: 0.1,
        platform,
        niche: 'test_mci_001',
      });
      expect(result.id).toBeGreaterThan(0);
    }
  });
});
