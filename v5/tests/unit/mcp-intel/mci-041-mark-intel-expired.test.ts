/**
 * mark_intel_expired
 * Tests: TEST-MCP-017
 */
import { markIntelExpired } from '../../../src/mcp-server/tools/intelligence/mark-intel-expired';
import { saveTrendingTopic } from '../../../src/mcp-server/tools/intelligence/save-trending-topic';
import { McpValidationError, McpNotFoundError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM market_intel WHERE niche = 'test_mci_041'`);
  });
}

describe('mark_intel_expired', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  test('TEST-MCP-017: marks intel as expired and returns success', async () => {
    // First create an intel entry
    const created = await saveTrendingTopic({
      topic: 'test_mci_041_topic',
      volume: 1000,
      growth_rate: 0.1,
      platform: 'tiktok',
      niche: 'test_mci_041',
    });

    const result = await markIntelExpired({ intel_id: created.id });
    expect(result).toEqual({ success: true });

    // Verify expires_at is set
    const dbCheck = await withClient(async (client) => {
      const res = await client.query(
        `SELECT expires_at FROM market_intel WHERE id = $1`,
        [created.id],
      );
      return res.rows[0];
    });

    expect(dbCheck).toBeDefined();
    expect(dbCheck.expires_at).not.toBeNull();
    expect(new Date(dbCheck.expires_at).getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('throws McpNotFoundError for non-existent intel_id', async () => {
    await expect(
      markIntelExpired({ intel_id: 999999999 }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('throws McpNotFoundError for already expired intel', async () => {
    // Create and expire
    const created = await saveTrendingTopic({
      topic: 'test_mci_041_already_expired',
      volume: 100,
      growth_rate: 0.05,
      platform: 'youtube',
      niche: 'test_mci_041',
    });

    await markIntelExpired({ intel_id: created.id });

    // Try to expire again
    await expect(
      markIntelExpired({ intel_id: created.id }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('rejects invalid intel_id', async () => {
    await expect(
      markIntelExpired({ intel_id: -1 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects zero intel_id', async () => {
    await expect(
      markIntelExpired({ intel_id: 0 }),
    ).rejects.toThrow(McpValidationError);
  });
});
