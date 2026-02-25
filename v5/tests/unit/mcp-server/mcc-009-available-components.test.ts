/**
 * Tests for get_available_components
 */
import { getAvailableComponents } from '@/src/mcp-server/tools/planner/get-available-components';
import { McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const PREFIX = 'TAVL_';

describe('get_available_components', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM content_sections WHERE component_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM components WHERE component_id LIKE '${PREFIX}%'`);
      await client.query(`
        INSERT INTO components (component_id, type, subtype, name, niche, score, usage_count, data)
        VALUES
          ('${PREFIX}SCN_001', 'scenario', 'hook', 'Test Hook 1', 'beauty', 85.0, 10, '{}'),
          ('${PREFIX}SCN_002', 'scenario', 'hook', 'Test Hook 2', 'beauty', 90.0, 5, '{"key":"val"}'),
          ('${PREFIX}SCN_003', 'scenario', 'cta', 'Test CTA 1', 'tech', 75.0, 3, '{}'),
          ('${PREFIX}MOT_001', 'motion', 'dance', 'Test Motion 1', 'beauty', 80.0, 7, '{}')
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM content_sections WHERE component_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM components WHERE component_id LIKE '${PREFIX}%'`);
    });
  });

  test('returns components filtered by type and niche', async () => {
    const result = await getAvailableComponents({ type: 'scenario', niche: 'beauty' });
    const testResults = result.components.filter(c => c.component_id.startsWith(PREFIX));
    expect(testResults.length).toBe(2);
    testResults.forEach(c => {
      expect(c).toHaveProperty('component_id');
      expect(c).toHaveProperty('name');
      expect(c).toHaveProperty('score');
      expect(c).toHaveProperty('usage_count');
      expect(c).toHaveProperty('data');
    });
  });

  test('returns components filtered by type, niche, and subtype', async () => {
    const result = await getAvailableComponents({
      type: 'scenario',
      niche: 'beauty',
      subtype: 'hook',
    });
    const testResults = result.components.filter(c => c.component_id.startsWith(PREFIX));
    expect(testResults.length).toBe(2);
  });

  test('returns ordered by score descending', async () => {
    const result = await getAvailableComponents({ type: 'scenario', niche: 'beauty' });
    const testResults = result.components.filter(c => c.component_id.startsWith(PREFIX));
    if (testResults.length >= 2) {
      expect(testResults[0]!.score).toBeGreaterThanOrEqual(testResults[1]!.score);
    }
  });

  test('rejects invalid type', async () => {
    await expect(
      getAvailableComponents({ type: 'invalid' as any, niche: 'beauty' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty niche', async () => {
    await expect(
      getAvailableComponents({ type: 'scenario', niche: '' }),
    ).rejects.toThrow(McpValidationError);
  });
});
