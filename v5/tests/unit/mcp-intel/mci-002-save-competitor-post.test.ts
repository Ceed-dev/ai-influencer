/**
 * FEAT-MCI-002: save_competitor_post
 * Tests: TEST-MCP-012
 */
import { saveCompetitorPost } from '../../../src/mcp-server/tools/intelligence/save-competitor-post';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM market_intel WHERE data->>'post_url' LIKE '%test_mci_002%'`);
  });
}

describe('FEAT-MCI-002: save_competitor_post', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  test('TEST-MCP-012: saves competitor post and returns id', async () => {
    const result = await saveCompetitorPost({
      post_url: 'https://tiktok.com/@user/video/test_mci_002',
      views: 1000000,
      format: 'short_video',
      hook_technique: 'question_hook',
      platform: 'tiktok',
    });

    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('number');
    expect(result.id).toBeGreaterThan(0);

    const dbCheck = await withClient(async (client) => {
      const res = await client.query(
        `SELECT intel_type, platform FROM market_intel WHERE id = $1`,
        [result.id],
      );
      return res.rows[0];
    });

    expect(dbCheck.intel_type).toBe('competitor_post');
    expect(dbCheck.platform).toBe('tiktok');
  });
});
