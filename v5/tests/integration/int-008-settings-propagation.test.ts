/**
 * FEAT-TST-008: system_settings 変更 → 全レイヤー反映
 * TEST-INT-008
 *
 * Verifies that changing a system_setting value in the database
 * is immediately readable by all layers (no caching delay).
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-008: system_settings change propagation', () => {
  let client: Client;
  const testKey = 'MAX_CONCURRENT_PRODUCTIONS';
  let originalValue: any;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    const res = await client.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = $1`, [testKey]
    );
    originalValue = res.rows[0]?.setting_value;
  });

  afterAll(async () => {
    if (originalValue !== undefined) {
      await client.query(
        `UPDATE system_settings SET setting_value = $1, updated_by = 'system'
         WHERE setting_key = $2`,
        [JSON.stringify(originalValue), testKey]
      );
    }
    await client.end();
  });

  test('TEST-INT-008: setting change is immediately readable', async () => {
    // Step 1: Change setting
    const newValue = 3;
    await client.query(
      `UPDATE system_settings SET setting_value = $1, updated_by = 'human', updated_at = NOW()
       WHERE setting_key = $2`,
      [JSON.stringify(newValue), testKey]
    );

    // Step 2: Read via separate query (simulating worker read)
    const workerClient = new Client({ connectionString: TEST_DB_URL });
    await workerClient.connect();
    try {
      const res = await workerClient.query(
        `SELECT setting_value FROM system_settings WHERE setting_key = $1`,
        [testKey]
      );
      expect(res.rows[0].setting_value).toBe(newValue);
    } finally {
      await workerClient.end();
    }
  });
});
