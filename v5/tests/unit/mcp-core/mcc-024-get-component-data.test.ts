/**
 * TEST-MCP-024: get_component_data — normal + not found
 * FEAT-MCC-024
 */
import { getComponentData } from '@/src/mcp-server/tools/production/get-component-data';
import { McpNotFoundError, McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const PREFIX = 'MCP_TEST_';

describe('FEAT-MCC-024: get_component_data', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`
        INSERT INTO components (component_id, type, subtype, name, data, drive_file_id)
        VALUES ($1, 'scenario', 'hook', 'Test Hook', '{"script_en":"Hello world"}', 'drive_file_abc')
        ON CONFLICT (component_id) DO NOTHING
      `, [`${PREFIX}CMP_001`]);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(
        `DELETE FROM components WHERE component_id LIKE '${PREFIX}%'`,
      );
    });
  });

  test('TEST-MCP-024a: returns component data for existing component', async () => {
    const result = await getComponentData({ component_id: `${PREFIX}CMP_001` });

    expect(result.type).toBe('scenario');
    expect(result.subtype).toBe('hook');
    expect(result.data).toHaveProperty('script_en');
    expect(result.data['script_en']).toBe('Hello world');
    expect(result.drive_file_id).toBe('drive_file_abc');
  });

  test('TEST-MCP-024b: throws McpNotFoundError for non-existent component', async () => {
    await expect(
      getComponentData({ component_id: 'NONEXISTENT_CMP' }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('TEST-MCP-024c: throws McpValidationError for empty component_id', async () => {
    await expect(
      getComponentData({ component_id: '' }),
    ).rejects.toThrow(McpValidationError);
  });
});
