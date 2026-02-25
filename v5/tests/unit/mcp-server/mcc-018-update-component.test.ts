/**
 * Tests for update_component_data
 */
import { updateComponentData } from '@/src/mcp-server/tools/curation/update-component-data';
import { McpValidationError, McpNotFoundError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const PREFIX = 'TUCD_';

describe('update_component_data', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM content_sections WHERE component_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM components WHERE component_id LIKE '${PREFIX}%'`);
      await client.query(`
        INSERT INTO components (component_id, type, subtype, name, data, tags)
        VALUES ('${PREFIX}SCN_001', 'scenario', 'hook', 'Test Component', '{"old":"data"}', ARRAY['tag1'])
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM content_sections WHERE component_id LIKE '${PREFIX}%'`);
      await client.query(`DELETE FROM components WHERE component_id LIKE '${PREFIX}%'`);
    });
  });

  test('updates component data successfully', async () => {
    const result = await updateComponentData({
      component_id: `${PREFIX}SCN_001`,
      data: { new: 'data', key: 'value' },
    });
    expect(result).toEqual({ success: true });
  });

  test('updates data and tags together', async () => {
    const result = await updateComponentData({
      component_id: `${PREFIX}SCN_001`,
      data: { updated: true },
      tags: ['tag1', 'tag2', 'new_tag'],
    });
    expect(result).toEqual({ success: true });
  });

  test('rejects empty component_id', async () => {
    await expect(
      updateComponentData({ component_id: '', data: {} }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws NotFoundError for nonexistent component', async () => {
    await expect(
      updateComponentData({ component_id: 'NONEXISTENT_CMP', data: { test: true } }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
