/**
 * TEST-MCP-033: update_system_config — normal + not found + validation
 * FEAT-MCC-033
 */
import { updateSystemConfig } from '@/src/mcp-server/tools/dashboard/update-system-config';
import { withClient } from '../../helpers/db';
import { McpValidationError, McpNotFoundError } from '@/src/mcp-server/errors';

const TEST_KEY = 'MCP_TEST_SETTING_033';

describe('FEAT-MCC-033: update_system_config', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`
        INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type, constraints, updated_by)
        VALUES ($1, '10'::jsonb, 'measurement', 'Test setting for mcc-033', '10'::jsonb, 'integer', '{"min": 1, "max": 100}', 'system')
        ON CONFLICT (setting_key) DO NOTHING
      `, [TEST_KEY]);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM system_settings WHERE setting_key = $1`, [TEST_KEY]);
    });
  });

  test('TEST-MCP-033a: updates setting value successfully', async () => {
    const result = await updateSystemConfig({ key: TEST_KEY, value: 50 });
    expect(result).toEqual({ success: true });

    // Verify update
    const res = await withClient(async (client) => {
      return client.query(`SELECT setting_value FROM system_settings WHERE setting_key = $1`, [TEST_KEY]);
    });
    expect(res.rows[0]?.setting_value).toBe(50);
  });

  test('TEST-MCP-033b: throws McpNotFoundError for non-existent key', async () => {
    await expect(
      updateSystemConfig({ key: 'NONEXISTENT_KEY', value: 42 }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('TEST-MCP-033c: throws McpValidationError for empty key', async () => {
    await expect(
      updateSystemConfig({ key: '', value: 42 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-033d: throws McpValidationError when value exceeds max constraint', async () => {
    await expect(
      updateSystemConfig({ key: TEST_KEY, value: 200 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-033e: throws McpValidationError when value below min constraint', async () => {
    await expect(
      updateSystemConfig({ key: TEST_KEY, value: 0 }),
    ).rejects.toThrow(McpValidationError);
  });
});
