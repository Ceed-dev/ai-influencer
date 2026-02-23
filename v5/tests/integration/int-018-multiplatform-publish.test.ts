/**
 * FEAT-TST-018: 複数プラットフォーム投稿 (1コンテンツ → 4プラットフォーム)
 * TEST-INT-018
 *
 * Verifies that one content can be published to all 4 platforms,
 * creating 4 publication records with distinct platform values.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-018: multi-platform publish', () => {
  let client: Client;
  const testCharId = 'CHR_INT018';
  const testContentId = 'CNT_INT018_001';
  const platforms = ['youtube', 'tiktok', 'instagram', 'x'];
  const accountIds = platforms.map(p => `ACC_INT018_${p}`);

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    for (const accId of accountIds) {
      await client.query(`DELETE FROM accounts WHERE account_id = $1`, [accId]);
    }
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'Test Char INT018', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
       ON CONFLICT (character_id) DO NOTHING`,
      [testCharId]
    );

    for (let i = 0; i < platforms.length; i++) {
      await client.query(
        `INSERT INTO accounts (account_id, platform, character_id, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (account_id) DO NOTHING`,
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
    for (const accId of accountIds) {
      await client.query(`DELETE FROM accounts WHERE account_id = $1`, [accId]);
    }
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-INT-018: 1 content → 4 platforms → 4 publications', async () => {
    // Publish to all 4 platforms
    for (let i = 0; i < platforms.length; i++) {
      await client.query(
        `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id)
         VALUES ($1, $2, $3, 'posted', NOW(), $4)`,
        [testContentId, accountIds[i], platforms[i], `POST_${platforms[i]}_001`]
      );
    }

    // Verify count
    const res = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM publications WHERE content_id = $1`,
      [testContentId]
    );
    expect(res.rows[0].cnt).toBe(4);

    // Verify distinct platforms
    const platformRes = await client.query(
      `SELECT DISTINCT platform FROM publications WHERE content_id = $1 ORDER BY platform`,
      [testContentId]
    );
    expect(platformRes.rows.map((r: any) => r.platform).sort()).toEqual(['instagram', 'tiktok', 'x', 'youtube']);
  });
});
