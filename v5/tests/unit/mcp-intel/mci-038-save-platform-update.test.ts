/**
 * save_platform_update
 * Tests: TEST-MCP-109
 */
import { savePlatformUpdate } from '../../../src/mcp-server/tools/intelligence/save-platform-update';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM market_intel WHERE data->>'description' LIKE '%test_mci_038%'`);
  });
}

describe('save_platform_update', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  test('TEST-MCP-109: saves platform update and returns id', async () => {
    const result = await savePlatformUpdate({
      platform: 'youtube',
      update_type: 'algorithm_change',
      description: 'test_mci_038 Shorts algorithm now favors 30-60s content',
      effective_date: '2026-03-01',
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
    expect(dbCheck.intel_type).toBe('platform_update');
    expect(dbCheck.platform).toBe('youtube');
    expect(dbCheck.data.update_type).toBe('algorithm_change');
    expect(dbCheck.data.description).toContain('test_mci_038');
    expect(dbCheck.data.effective_date).toBe('2026-03-01');
  });

  test('rejects invalid platform', async () => {
    await expect(
      savePlatformUpdate({
        platform: 'facebook' as any,
        update_type: 'algo',
        description: 'test_mci_038_invalid',
        effective_date: '2026-03-01',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty update_type', async () => {
    await expect(
      savePlatformUpdate({
        platform: 'youtube',
        update_type: '',
        description: 'test_mci_038_empty',
        effective_date: '2026-03-01',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects invalid effective_date', async () => {
    await expect(
      savePlatformUpdate({
        platform: 'youtube',
        update_type: 'algo',
        description: 'test_mci_038_baddate',
        effective_date: 'not-a-date',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('accepts all valid platforms', async () => {
    for (const platform of ['youtube', 'tiktok', 'instagram', 'x'] as const) {
      const result = await savePlatformUpdate({
        platform,
        update_type: 'feature_update',
        description: `test_mci_038_${platform} update`,
        effective_date: '2026-04-01',
      });
      expect(result.id).toBeGreaterThan(0);
    }
  });
});
