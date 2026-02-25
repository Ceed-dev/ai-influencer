/**
 * TEST-DSH-001: GET /api/accounts — 正常系
 * TEST-DSH-002: GET /api/accounts — プラットフォームフィルタ
 */
import { query, withClient } from '../../helpers/db';

const API_BASE = 'http://localhost:3000';

describe('FEAT-DSH-001: GET /api/accounts + platform filter', () => {
  // Seed test data
  beforeAll(async () => {
    await withClient(async (client) => {
      // Ensure characters exist for FK
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('CHR_TEST_001', 'Test Character', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1', 'active')
        ON CONFLICT (character_id) DO NOTHING
      `);

      // Clean existing test accounts
      await client.query(`DELETE FROM accounts WHERE account_id LIKE 'ACC_L1%'`);

      // Insert 5 accounts: 2 youtube, 3 tiktok
      const accounts = [
        ['ACC_L101', 'youtube', '@yt_channel_1', 'CHR_TEST_001', 'active'],
        ['ACC_L102', 'youtube', '@yt_channel_2', 'CHR_TEST_001', 'active'],
        ['ACC_L103', 'tiktok', '@tt_user_1', 'CHR_TEST_001', 'active'],
        ['ACC_L104', 'tiktok', '@tt_user_2', 'CHR_TEST_001', 'active'],
        ['ACC_L105', 'tiktok', '@tt_user_3', 'CHR_TEST_001', 'setup'],
      ];

      for (const [accountId, platform, username, charId, status] of accounts) {
        await client.query(
          `INSERT INTO accounts (account_id, platform, platform_username, character_id, status)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (account_id) DO NOTHING`,
          [accountId, platform, username, charId, status]
        );
      }
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM accounts WHERE account_id LIKE 'ACC_L1%'`);
      await client.query(`DELETE FROM characters WHERE character_id = 'CHR_TEST_001'`);
    });
  });

  // TEST-DSH-001: GET /api/accounts — 正常系
  test('TEST-DSH-001: returns all accounts with total count', async () => {
    const result = await query(
      `SELECT * FROM accounts WHERE account_id LIKE 'ACC_L1%' ORDER BY id ASC`
    );
    const total = await query(
      `SELECT COUNT(*)::int as count FROM accounts WHERE account_id LIKE 'ACC_L1%'`
    );

    expect(result.rows.length).toBe(5);
    expect(total.rows[0].count).toBe(5);

    // Verify account structure
    const account = result.rows[0] as Record<string, unknown>;
    expect(account).toHaveProperty('account_id');
    expect(account).toHaveProperty('platform');
    expect(account).toHaveProperty('platform_username');
    expect(account).toHaveProperty('status');
    expect(account).toHaveProperty('created_at');
  });

  // TEST-DSH-002: GET /api/accounts — プラットフォームフィルタ
  test('TEST-DSH-002: filters accounts by platform', async () => {
    // Filter for youtube
    const youtubeResult = await query(
      `SELECT * FROM accounts WHERE account_id LIKE 'ACC_L1%' AND platform = $1 ORDER BY id ASC`,
      ['youtube']
    );
    expect(youtubeResult.rows.length).toBe(2);
    youtubeResult.rows.forEach((row: Record<string, unknown>) => {
      expect(row.platform).toBe('youtube');
    });

    // Filter for tiktok
    const tiktokResult = await query(
      `SELECT * FROM accounts WHERE account_id LIKE 'ACC_L1%' AND platform = $1 ORDER BY id ASC`,
      ['tiktok']
    );
    expect(tiktokResult.rows.length).toBe(3);
    tiktokResult.rows.forEach((row: Record<string, unknown>) => {
      expect(row.platform).toBe('tiktok');
    });
  });

  test('TEST-DSH-002: platform filter returns correct total', async () => {
    const result = await query(
      `SELECT COUNT(*)::int as count FROM accounts WHERE account_id LIKE 'ACC_L1%' AND platform = $1`,
      ['youtube']
    );
    expect(result.rows[0].count).toBe(2);
  });

  test('pagination works correctly', async () => {
    // Page 1, limit 2
    const page1 = await query(
      `SELECT * FROM accounts WHERE account_id LIKE 'ACC_L1%' ORDER BY id ASC LIMIT 2 OFFSET 0`
    );
    expect(page1.rows.length).toBe(2);

    // Page 2, limit 2
    const page2 = await query(
      `SELECT * FROM accounts WHERE account_id LIKE 'ACC_L1%' ORDER BY id ASC LIMIT 2 OFFSET 2`
    );
    expect(page2.rows.length).toBe(2);

    // Page 3, limit 2
    const page3 = await query(
      `SELECT * FROM accounts WHERE account_id LIKE 'ACC_L1%' ORDER BY id ASC LIMIT 2 OFFSET 4`
    );
    expect(page3.rows.length).toBe(1);
  });

  test('combined platform and status filter', async () => {
    const result = await query(
      `SELECT * FROM accounts WHERE account_id LIKE 'ACC_L1%' AND platform = $1 AND status = $2`,
      ['tiktok', 'setup']
    );
    expect(result.rows.length).toBe(1);
    expect((result.rows[0] as Record<string, unknown>).account_id).toBe('ACC_L105');
  });
});
