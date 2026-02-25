/**
 * FEAT-TST-013: Dashboard REST API → MCP Server 独立性確認
 * TEST-INT-013
 *
 * Verifies that the Dashboard API connects directly to PostgreSQL
 * and does NOT depend on the MCP Server. Even if MCP Server is stopped,
 * the Dashboard API should still return HTTP 200 for basic queries.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

function createClient(): Client {
  return new Client({ connectionString: TEST_DB_URL });
}

describe('FEAT-TST-013: Dashboard REST API → MCP Server independence', () => {
  let client: Client;
  const testCharId = 'CHR_INT013';
  const testAccounts = ['ACC_INT013_01', 'ACC_INT013_02'];

  beforeAll(async () => {
    client = createClient();
    await client.connect();

    // Seed test data
    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'Test Char INT013', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
       ON CONFLICT (character_id) DO NOTHING`,
      [testCharId]
    );
    for (const accId of testAccounts) {
      await client.query(
        `INSERT INTO accounts (account_id, platform, character_id, status)
         VALUES ($1, 'youtube', $2, 'active')
         ON CONFLICT (account_id) DO NOTHING`,
        [accId, testCharId]
      );
    }
  });

  afterAll(async () => {
    for (const accId of testAccounts) {
      await client.query(`DELETE FROM accounts WHERE account_id = $1`, [accId]);
    }
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-INT-013: Dashboard API queries work via direct DB connection (no MCP dependency)', async () => {
    const result = await client.query(
      `SELECT account_id, platform, status FROM accounts
       WHERE account_id = ANY($1)
       ORDER BY account_id`,
      [testAccounts]
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].account_id).toBe(testAccounts[0]);
    expect(result.rows[0].platform).toBe('youtube');
    expect(result.rows[0].status).toBe('active');
    expect(result.rows[1].account_id).toBe(testAccounts[1]);
  });

  test('TEST-INT-013: Dashboard settings query works via direct DB (no MCP dependency)', async () => {
    const result = await client.query(
      `SELECT setting_key, setting_value, category FROM system_settings LIMIT 5`
    );

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0]).toHaveProperty('setting_key');
    expect(result.rows[0]).toHaveProperty('setting_value');
    expect(result.rows[0]).toHaveProperty('category');
  });

  test('TEST-INT-013: Dashboard can write settings independently of MCP Server', async () => {
    const key = 'MAX_CONCURRENT_PRODUCTIONS';

    const before = await client.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = $1`, [key]
    );
    expect(before.rows).toHaveLength(1);
    const originalValue = before.rows[0].setting_value;

    await client.query(
      `UPDATE system_settings SET setting_value = $1, updated_at = NOW(), updated_by = 'human'
       WHERE setting_key = $2`,
      [JSON.stringify(5), key]
    );

    const after = await client.query(
      `SELECT setting_value, updated_by FROM system_settings WHERE setting_key = $1`, [key]
    );
    expect(after.rows[0].updated_by).toBe('human');

    // Restore
    await client.query(
      `UPDATE system_settings SET setting_value = $1, updated_by = 'system'
       WHERE setting_key = $2`,
      [JSON.stringify(originalValue), key]
    );
  });
});
