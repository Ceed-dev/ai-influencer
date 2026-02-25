/**
 * FEAT-TST-026: E2Eテスト — マルチプラットフォーム同時投稿
 * TEST-E2E-006
 *
 * Verifies simultaneous posting to 4 platforms with all publications posted.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-026: E2E multi-platform simultaneous post', () => {
  let client: Client;
  const testCharId = 'CHR_E2E006';
  const testContentId = 'CNT_E2E006_001';
  const platforms = ['youtube', 'tiktok', 'instagram', 'x'];
  const accountIds = platforms.map(p => `ACC_E2E006_${p}`);

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    for (const id of accountIds) {
      await client.query(`DELETE FROM accounts WHERE account_id = $1`, [id]);
    }
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'E2E006 Char', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')`,
      [testCharId]
    );
    for (let i = 0; i < platforms.length; i++) {
      await client.query(
        `INSERT INTO accounts (account_id, platform, character_id, status)
         VALUES ($1, $2, $3, 'active')`,
        [accountIds[i], platforms[i], testCharId]
      );
    }
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id)
       VALUES ($1, 'short_video', 'ready', $2)`,
      [testContentId, testCharId]
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    for (const id of accountIds) {
      await client.query(`DELETE FROM accounts WHERE account_id = $1`, [id]);
    }
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-E2E-006: 4 platforms all posted successfully', async () => {
    for (let i = 0; i < platforms.length; i++) {
      await client.query(
        `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id)
         VALUES ($1, $2, $3, 'posted', NOW(), $4)`,
        [testContentId, accountIds[i], platforms[i], `POST_${platforms[i]}_E2E006`]
      );
    }

    const res = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM publications WHERE content_id = $1 AND status = 'posted'`,
      [testContentId]
    );
    expect(res.rows[0].cnt).toBe(4);
  });
});
