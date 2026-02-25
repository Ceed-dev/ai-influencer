/**
 * TEST-DSH-003: GET /api/accounts/:id — 正常系
 * TEST-DSH-004: GET /api/accounts/:id — 存在しないID
 */
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-002: GET /api/accounts/:id + 404 handling', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('CHR_TEST_002', 'Test Char 2', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2', 'active')
        ON CONFLICT (character_id) DO NOTHING
      `);
      await client.query(`DELETE FROM accounts WHERE account_id = 'ACC_T013'`);
      await client.query(`
        INSERT INTO accounts (account_id, platform, platform_username, character_id, status)
        VALUES ('ACC_T013', 'youtube', '@test_yt_13', 'CHR_TEST_002', 'active')
        ON CONFLICT (account_id) DO NOTHING
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM accounts WHERE account_id = 'ACC_T013'`);
      await client.query(`DELETE FROM characters WHERE character_id = 'CHR_TEST_002'`);
    });
  });

  // TEST-DSH-003: GET /api/accounts/:id — 正常系
  test('TEST-DSH-003: returns account by ID with related data', async () => {
    const result = await query(
      `SELECT a.*, c.name as character_name FROM accounts a
       LEFT JOIN characters c ON a.character_id = c.character_id
       WHERE a.account_id = $1`,
      ['ACC_T013']
    );

    expect(result.rows.length).toBe(1);
    const account = result.rows[0] as Record<string, unknown>;
    expect(account.account_id).toBe('ACC_T013');
    expect(account.platform).toBe('youtube');
    expect(account.character_name).toBe('Test Char 2');
  });

  // TEST-DSH-004: GET /api/accounts/:id — 存在しないID
  test('TEST-DSH-004: returns null for non-existent account', async () => {
    const result = await query(
      `SELECT * FROM accounts WHERE account_id = $1`,
      ['ACC_9999']
    );

    expect(result.rows.length).toBe(0);
  });
});
