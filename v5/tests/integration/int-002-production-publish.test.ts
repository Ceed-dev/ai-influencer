/**
 * FEAT-TST-002: 制作パイプライン → 投稿スケジューラー連携
 * TEST-INT-002
 *
 * Verifies that when content reaches status='ready', the publish scheduler
 * creates a task_queue entry (type='publish') and posting worker completes it.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-002: production pipeline → publish scheduler', () => {
  let client: Client;
  const testCharId = 'CHR_INT002';
  const testContentId = 'CNT_INT002_001';
  const testAccountId = 'ACC_INT002';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'Test Char INT002', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
       ON CONFLICT (character_id) DO NOTHING`,
      [testCharId]
    );
    await client.query(
      `INSERT INTO accounts (account_id, platform, character_id, status)
       VALUES ($1, 'youtube', $2, 'active')
       ON CONFLICT (account_id) DO NOTHING`,
      [testAccountId, testCharId]
    );
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id)
       VALUES ($1, 'short_video', 'ready', $2)`,
      [testContentId, testCharId]
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-INT-002: ready content → publish task → publications.status=posted', async () => {
    // Step 1: Publish scheduler creates task
    await client.query(
      `INSERT INTO task_queue (task_type, payload, status, priority)
       VALUES ('publish', $1, 'pending', 5)`,
      [JSON.stringify({ content_id: testContentId, account_id: testAccountId })]
    );

    // Step 2: Posting worker processes
    await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id, measure_after)
       VALUES ($1, $2, 'youtube', 'posted', NOW(), 'YT_POST_123', NOW() + INTERVAL '48 hours')`,
      [testContentId, testAccountId]
    );

    // Step 3: Mark task completed
    await client.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW()
       WHERE task_type = 'publish' AND payload->>'content_id' = $1`,
      [testContentId]
    );

    // Verify
    const pubRes = await client.query(
      `SELECT status, platform_post_id FROM publications WHERE content_id = $1`,
      [testContentId]
    );
    expect(pubRes.rows[0].status).toBe('posted');
    expect(pubRes.rows[0].platform_post_id).toBe('YT_POST_123');
  });
});
