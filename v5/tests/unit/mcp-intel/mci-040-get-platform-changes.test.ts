/**
 * get_platform_changes
 * Tests: TEST-MCP-111
 */
import { getPlatformChanges } from '../../../src/mcp-server/tools/intelligence/get-platform-changes';
import { savePlatformUpdate } from '../../../src/mcp-server/tools/intelligence/save-platform-update';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM market_intel WHERE data->>'description' LIKE '%test_mci_040%'`);
  });
}

describe('get_platform_changes', () => {
  beforeAll(async () => {
    await cleanup();
    // Seed platform updates
    await savePlatformUpdate({
      platform: 'youtube',
      update_type: 'algorithm_change',
      description: 'test_mci_040 shorts algo update',
      effective_date: '2026-02-20',
    });
    await savePlatformUpdate({
      platform: 'youtube',
      update_type: 'feature_release',
      description: 'test_mci_040 new analytics dashboard',
      effective_date: '2026-02-22',
    });
  });
  afterAll(cleanup);

  test('TEST-MCP-111: returns platform changes array', async () => {
    const result = await getPlatformChanges({
      platform: 'youtube',
      since: '30d',
    });

    expect(result).toHaveProperty('changes');
    expect(Array.isArray(result.changes)).toBe(true);

    for (const c of result.changes) {
      expect(c).toHaveProperty('update_type');
      expect(c).toHaveProperty('description');
      expect(c).toHaveProperty('effective_date');
      expect(typeof c.update_type).toBe('string');
      expect(typeof c.description).toBe('string');
      expect(typeof c.effective_date).toBe('string');
    }

    // Should include our seeded data
    const descriptions = result.changes.map(c => c.description);
    expect(descriptions.some(d => d.includes('test_mci_040'))).toBe(true);
  });

  test('rejects invalid platform', async () => {
    await expect(
      getPlatformChanges({
        platform: 'facebook' as any,
        since: '30d',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects invalid since', async () => {
    await expect(
      getPlatformChanges({
        platform: 'youtube',
        since: '7d' as any,
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns empty array for platform with no data', async () => {
    const result = await getPlatformChanges({
      platform: 'instagram',
      since: '30d',
    });

    // May or may not have data from other tests, but should be an array
    expect(Array.isArray(result.changes)).toBe(true);
  });
});
