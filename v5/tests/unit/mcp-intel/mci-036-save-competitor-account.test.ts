/**
 * save_competitor_account
 * Tests: TEST-MCP-107
 */
import { saveCompetitorAccount } from '../../../src/mcp-server/tools/intelligence/save-competitor-account';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM market_intel WHERE data->>'username' LIKE '%test_mci_036%'`);
  });
}

describe('save_competitor_account', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  test('TEST-MCP-107: saves competitor account and returns id', async () => {
    const result = await saveCompetitorAccount({
      username: '@test_mci_036_beauty_guru',
      followers: 500000,
      posting_frequency: 'daily',
      platform: 'tiktok',
    });

    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('number');
    expect(result.id).toBeGreaterThan(0);

    const dbCheck = await withClient(async (client) => {
      const res = await client.query(
        `SELECT intel_type, platform, data FROM market_intel WHERE id = $1`,
        [result.id],
      );
      return res.rows[0];
    });

    expect(dbCheck).toBeDefined();
    expect(dbCheck.intel_type).toBe('competitor_account');
    expect(dbCheck.platform).toBe('tiktok');
    expect(dbCheck.data.username).toBe('@test_mci_036_beauty_guru');
    expect(dbCheck.data.followers).toBe(500000);
    expect(dbCheck.data.posting_frequency).toBe('daily');
  });

  test('rejects invalid platform', async () => {
    await expect(
      saveCompetitorAccount({
        username: '@test_mci_036_invalid',
        followers: 100,
        posting_frequency: 'weekly',
        platform: 'facebook' as any,
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty username', async () => {
    await expect(
      saveCompetitorAccount({
        username: '',
        followers: 100,
        posting_frequency: 'weekly',
        platform: 'tiktok',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects negative followers', async () => {
    await expect(
      saveCompetitorAccount({
        username: '@test_mci_036_neg',
        followers: -1,
        posting_frequency: 'weekly',
        platform: 'tiktok',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('accepts all valid platforms', async () => {
    for (const platform of ['youtube', 'tiktok', 'instagram', 'x'] as const) {
      const result = await saveCompetitorAccount({
        username: `@test_mci_036_${platform}`,
        followers: 1000,
        posting_frequency: 'weekly',
        platform,
      });
      expect(result.id).toBeGreaterThan(0);
    }
  });
});
