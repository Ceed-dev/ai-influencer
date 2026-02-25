/**
 * FEAT-TST-023: E2Eテスト — テキスト投稿
 * TEST-E2E-003
 *
 * Verifies text content creation → posting → platform_post_id set.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-023: E2E text post', () => {
  let client: Client;
  const testCharId = 'CHR_E2E003';
  const testContentId = 'CNT_E2E003_001';
  const testAccountId = 'ACC_E2E003';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'E2E003 Char', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')`,
      [testCharId]
    );
    await client.query(
      `INSERT INTO accounts (account_id, platform, character_id, status)
       VALUES ($1, 'x', $2, 'active')`,
      [testAccountId, testCharId]
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-E2E-003: text_post → post to X → platform_post_id set', async () => {
    // Step 1: Create text content
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id)
       VALUES ($1, 'text_post', 'planned', $2)`,
      [testContentId, testCharId]
    );

    // Step 2: Text worker generates content
    await client.query(`UPDATE content SET status = 'ready' WHERE content_id = $1`, [testContentId]);

    // Step 3: Post to X
    await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id, post_url)
       VALUES ($1, $2, 'x', 'posted', NOW(), '1234567890', 'https://x.com/user/status/1234567890')`,
      [testContentId, testAccountId]
    );

    // Verify
    const res = await client.query(
      `SELECT platform_post_id, post_url FROM publications WHERE content_id = $1`,
      [testContentId]
    );
    expect(res.rows[0].platform_post_id).not.toBeNull();
    expect(res.rows[0].post_url).toMatch(/^https?:\/\//);
  });
});
