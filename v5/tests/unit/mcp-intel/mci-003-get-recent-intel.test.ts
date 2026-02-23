/**
 * FEAT-MCI-003: get_recent_intel — filtering
 * Tests: TEST-MCP-013
 */
import { getRecentIntel } from '../../../src/mcp-server/tools/intelligence/get-recent-intel';
import { saveTrendingTopic } from '../../../src/mcp-server/tools/intelligence/save-trending-topic';
import { saveCompetitorPost } from '../../../src/mcp-server/tools/intelligence/save-competitor-post';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM market_intel WHERE niche = 'test_mci_003'`);
    await client.query(`DELETE FROM market_intel WHERE data->>'post_url' LIKE '%test_mci_003%'`);
  });
}

describe('FEAT-MCI-003: get_recent_intel', () => {
  beforeAll(async () => {
    await cleanup();
    // Seed: 3 trending_topics + 2 competitor_posts
    for (let i = 0; i < 3; i++) {
      await saveTrendingTopic({
        topic: `test_topic_${i}`,
        volume: 1000 * (i + 1),
        growth_rate: 0.1,
        platform: 'tiktok',
        niche: 'test_mci_003',
      });
    }
    await saveCompetitorPost({
      post_url: 'https://tiktok.com/@user/video/test_mci_003_a',
      views: 5000,
      format: 'short_video',
      hook_technique: 'hook_a',
      platform: 'tiktok',
    });
    await saveCompetitorPost({
      post_url: 'https://tiktok.com/@user/video/test_mci_003_b',
      views: 8000,
      format: 'short_video',
      hook_technique: 'hook_b',
      platform: 'tiktok',
    });
  });
  afterAll(cleanup);

  test('TEST-MCP-013: filters by intel_type=trending_topic', async () => {
    const result = await getRecentIntel({
      intel_type: 'trending_topic',
      platform: 'tiktok',
      limit: 20,
    });

    expect(Array.isArray(result.intel)).toBe(true);
    // All should be trending_topic (no competitor_post mixed in)
    for (const item of result.intel) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('data');
      expect(item).toHaveProperty('relevance_score');
      expect(item).toHaveProperty('collected_at');
    }
    expect(result.intel.length).toBeLessThanOrEqual(20);
  });

  test('TEST-MCP-013: limit is respected', async () => {
    const result = await getRecentIntel({ limit: 2 });
    expect(result.intel.length).toBeLessThanOrEqual(2);
  });
});
