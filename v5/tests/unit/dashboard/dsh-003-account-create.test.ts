/**
 * TEST-DSH-005: POST /api/accounts — アカウント作成
 * TEST-DSH-006: POST /api/accounts — 不正プラットフォーム拒否
 */
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-003: POST /api/accounts + platform validation', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('CHR_TEST_003', 'Test Char 3', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3', 'active')
        ON CONFLICT (character_id) DO NOTHING
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM accounts WHERE account_id LIKE 'ACC_T5%'`);
      await client.query(`DELETE FROM characters WHERE character_id = 'CHR_TEST_003'`);
    });
  });

  // TEST-DSH-005: POST /api/accounts — アカウント作成
  test('TEST-DSH-005: creates account with valid data', async () => {
    const result = await query(
      `INSERT INTO accounts (account_id, platform, platform_username, character_id, status)
       VALUES ('ACC_T500', 'youtube', '@test_channel', 'CHR_TEST_003', 'setup')
       RETURNING *`
    );

    expect(result.rows.length).toBe(1);
    const account = result.rows[0] as Record<string, unknown>;
    expect(account.account_id).toBe('ACC_T500');
    expect(account.platform).toBe('youtube');
    expect(account.platform_username).toBe('@test_channel');
  });

  // TEST-DSH-006: POST /api/accounts — 不正プラットフォーム拒否
  test('TEST-DSH-006: rejects invalid platform at DB level', async () => {
    await expect(
      query(
        `INSERT INTO accounts (account_id, platform, platform_username, character_id, status)
         VALUES ('ACC_T501', 'facebook', '@test_fb', 'CHR_TEST_003', 'setup')`
      )
    ).rejects.toThrow();
  });

  test('valid platforms are accepted', async () => {
    const validPlatforms = ['youtube', 'tiktok', 'instagram', 'x'];
    for (const [i, platform] of validPlatforms.entries()) {
      const accId = `ACC_T5${10 + i}`;
      const result = await query(
        `INSERT INTO accounts (account_id, platform, platform_username, character_id, status)
         VALUES ($1, $2, $3, 'CHR_TEST_003', 'setup')
         RETURNING *`,
        [accId, platform, `@test_${platform}`]
      );
      expect(result.rows.length).toBe(1);
    }
  });
});
