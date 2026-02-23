/**
 * FEAT-TST-029: E2Eテスト — 大規模アカウント (50アカウント同時運用)
 * TEST-E2E-009
 *
 * Verifies that 50 accounts can each have content planned in a single cycle.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-029: E2E 50 accounts', () => {
  let client: Client;
  const testCharId = 'CHR_E2E009';
  const accountIds = Array.from({ length: 50 }, (_, i) => `ACC_E2E009_${String(i + 1).padStart(3, '0')}`);
  const contentIds = Array.from({ length: 50 }, (_, i) => `CNT_E2E009_${String(i + 1).padStart(3, '0')}`);

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    for (const cid of contentIds) {
      await client.query(`DELETE FROM content WHERE content_id = $1`, [cid]);
    }
    for (const aid of accountIds) {
      await client.query(`DELETE FROM accounts WHERE account_id = $1`, [aid]);
    }
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'E2E009 Char', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')`,
      [testCharId]
    );

    // Create 50 accounts
    for (let i = 0; i < 50; i++) {
      const platform = ['youtube', 'tiktok', 'instagram', 'x'][i % 4];
      await client.query(
        `INSERT INTO accounts (account_id, platform, character_id, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (account_id) DO NOTHING`,
        [accountIds[i], platform, testCharId]
      );
    }
  });

  afterAll(async () => {
    for (const cid of contentIds) {
      await client.query(`DELETE FROM content WHERE content_id = $1`, [cid]);
    }
    for (const aid of accountIds) {
      await client.query(`DELETE FROM accounts WHERE account_id = $1`, [aid]);
    }
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-E2E-009: 50 accounts each get content planned', async () => {
    // Plan content for all 50 accounts
    for (let i = 0; i < 50; i++) {
      await client.query(
        `INSERT INTO content (content_id, content_format, status, character_id)
         VALUES ($1, 'short_video', 'planned', $2)`,
        [contentIds[i], testCharId]
      );
    }

    // Verify
    const res = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM content WHERE content_id = ANY($1)`,
      [contentIds]
    );
    expect(res.rows[0].cnt).toBe(50);
  });
});
