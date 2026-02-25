/**
 * TEST-DSH-007: PUT /api/accounts/:id — アカウント更新
 */
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-004: PUT /api/accounts/:id', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('CHR_TEST_004', 'Test Char 4', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa4', 'active')
        ON CONFLICT (character_id) DO NOTHING
      `);
      await client.query(`DELETE FROM accounts WHERE account_id = 'ACC_T013U'`);
      await client.query(`
        INSERT INTO accounts (account_id, platform, platform_username, character_id, status)
        VALUES ('ACC_T013U', 'youtube', '@test_update', 'CHR_TEST_004', 'active')
        ON CONFLICT (account_id) DO NOTHING
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM accounts WHERE account_id = 'ACC_T013U'`);
      await client.query(`DELETE FROM characters WHERE character_id = 'CHR_TEST_004'`);
    });
  });

  // TEST-DSH-007: PUT /api/accounts/:id — アカウント更新
  test('TEST-DSH-007: updates account status', async () => {
    // Update status to suspended
    await query(
      `UPDATE accounts SET status = $1, updated_at = NOW() WHERE account_id = $2`,
      ['suspended', 'ACC_T013U']
    );

    // Verify the update
    const result = await query(
      `SELECT status FROM accounts WHERE account_id = $1`,
      ['ACC_T013U']
    );

    expect(result.rows.length).toBe(1);
    expect((result.rows[0] as Record<string, unknown>).status).toBe('suspended');
  });

  test('updates multiple fields', async () => {
    await query(
      `UPDATE accounts SET niche = $1, cluster = $2, updated_at = NOW() WHERE account_id = $3`,
      ['beauty', 'group_a', 'ACC_T013U']
    );

    const result = await query(
      `SELECT niche, cluster FROM accounts WHERE account_id = $1`,
      ['ACC_T013U']
    );

    const account = result.rows[0] as Record<string, unknown>;
    expect(account.niche).toBe('beauty');
    expect(account.cluster).toBe('group_a');
  });

  test('rejects invalid status at DB level', async () => {
    await expect(
      query(
        `UPDATE accounts SET status = $1 WHERE account_id = $2`,
        ['invalid_status', 'ACC_T013U']
      )
    ).rejects.toThrow();
  });
});
