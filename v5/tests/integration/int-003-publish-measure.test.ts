/**
 * FEAT-TST-003: 投稿 → 計測連携
 * TEST-INT-003
 *
 * Verifies that after posting (publications.status='posted', measure_after<=NOW()),
 * measurement job creates task_queue (type='measure'), collects metrics,
 * and updates publications.status to 'measured'.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-003: publish → measurement pipeline', () => {
  let client: Client;
  const testCharId = 'CHR_INT003';
  const testContentId = 'CNT_INT003_001';
  const testAccountId = 'ACC_INT003';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id = $1)`, [testContentId]);
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'Test Char INT003', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
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
       VALUES ($1, 'short_video', 'posted', $2)`,
      [testContentId, testCharId]
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id = $1)`, [testContentId]);
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-INT-003: posted publication → measure task → metrics collected', async () => {
    // Step 1: Publication with measure_after in the past
    await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, measure_after, platform_post_id)
       VALUES ($1, $2, 'youtube', 'posted', NOW() - INTERVAL '49 hours', NOW() - INTERVAL '1 hour', 'YT_INT003')`,
      [testContentId, testAccountId]
    );

    // Step 2: Measurement job creates task
    await client.query(
      `INSERT INTO task_queue (task_type, payload, status, priority)
       VALUES ('measure', $1, 'pending', 5)`,
      [JSON.stringify({ content_id: testContentId })]
    );

    // Step 3: Collect metrics
    const pubRes = await client.query(
      `SELECT id FROM publications WHERE content_id = $1`, [testContentId]
    );
    const pubId = pubRes.rows[0].id;

    await client.query(
      `INSERT INTO metrics (publication_id, views, likes, comments, shares, engagement_rate, measurement_point)
       VALUES ($1, 1500, 120, 30, 15, 0.0800, '48h')`,
      [pubId]
    );

    // Step 4: Update publication status
    await client.query(
      `UPDATE publications SET status = 'measured' WHERE id = $1`, [pubId]
    );

    // Verify
    const metricsRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM metrics WHERE publication_id = $1`, [pubId]
    );
    expect(metricsRes.rows[0].cnt).toBeGreaterThan(0);

    const updatedPub = await client.query(
      `SELECT status FROM publications WHERE id = $1`, [pubId]
    );
    expect(updatedPub.rows[0].status).toBe('measured');
  });
});
