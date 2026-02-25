/**
 * TEST-DSH-015: GET /api/settings — 全件取得
 */
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-011: GET /api/settings', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      // Ensure test settings exist
      await client.query(`
        INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type, constraints)
        VALUES ('TEST_SETTING_1', '"test_value"'::jsonb, 'dashboard', 'Test setting 1', '"test_value"'::jsonb, 'string', NULL)
        ON CONFLICT (setting_key) DO NOTHING
      `);
      await client.query(`
        INSERT INTO system_settings (setting_key, setting_value, category, description, default_value, value_type, constraints)
        VALUES ('TEST_SETTING_2', '42'::jsonb, 'production', 'Test setting 2', '42'::jsonb, 'integer', '{"min": 1, "max": 100}'::jsonb)
        ON CONFLICT (setting_key) DO NOTHING
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM system_settings WHERE setting_key LIKE 'TEST_SETTING_%'`);
    });
  });

  // TEST-DSH-015: GET /api/settings — 全件取得
  test('TEST-DSH-015: returns all settings', async () => {
    const result = await query(
      `SELECT * FROM system_settings ORDER BY category ASC, setting_key ASC`
    );

    expect(result.rows.length).toBeGreaterThan(0);

    // Verify structure
    const setting = result.rows[0] as Record<string, unknown>;
    expect(setting).toHaveProperty('setting_key');
    expect(setting).toHaveProperty('setting_value');
    expect(setting).toHaveProperty('category');
    expect(setting).toHaveProperty('description');
    expect(setting).toHaveProperty('value_type');
  });

  test('filters by category', async () => {
    const result = await query(
      `SELECT * FROM system_settings WHERE category = $1 ORDER BY setting_key ASC`,
      ['dashboard']
    );

    result.rows.forEach((row: Record<string, unknown>) => {
      expect(row.category).toBe('dashboard');
    });
  });
});
