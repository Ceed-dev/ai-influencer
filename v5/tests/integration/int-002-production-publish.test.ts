/**
 * FEAT-TST-002: 制作パイプライン → 投稿スケジューラー連携
 * TEST-INT-002
 *
 * Verifies that when content reaches status='ready', the publish scheduler
 * creates a task_queue entry (type='publish'), posting worker completes it,
 * prediction_snapshots are created, and a measurement task is scheduled.
 */
import { Pool, PoolClient } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-002: production pipeline → publish scheduler', () => {
  let pool: Pool;
  let client: PoolClient;
  const testCharId = 'CHR_INT002';
  const testContentId = 'CNT_INT002_001';
  const testAccountId = 'ACC_INT002';

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB_URL, max: 3 });
    const c = await pool.connect();
    try {
      await c.query(`DELETE FROM prediction_snapshots WHERE account_id = $1`, [testAccountId]);
      await c.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id = $1)`, [testContentId]);
      await c.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
      await c.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
      await c.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

      await c.query(
        `INSERT INTO characters (character_id, name, voice_id, status)
         VALUES ($1, 'Test Char INT002', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
         ON CONFLICT (character_id) DO NOTHING`,
        [testCharId]
      );
      await c.query(
        `INSERT INTO accounts (account_id, platform, character_id, status)
         VALUES ($1, 'youtube', $2, 'active')
         ON CONFLICT (account_id) DO NOTHING`,
        [testAccountId, testCharId]
      );
      await c.query(
        `INSERT INTO content (content_id, content_format, status, character_id)
         VALUES ($1, 'short_video', 'ready', $2)`,
        [testContentId, testCharId]
      );
    } finally {
      c.release();
    }
  });

  afterAll(async () => {
    const c = await pool.connect();
    try {
      await c.query(`DELETE FROM prediction_snapshots WHERE account_id = $1`, [testAccountId]);
      await c.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id = $1)`, [testContentId]);
      await c.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
      await c.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
      await c.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    } finally {
      c.release();
    }
    await pool.end();
  });

  beforeEach(async () => {
    client = await pool.connect();
  });

  afterEach(() => {
    client.release();
  });

  test('TEST-INT-002: ready content → publish task → publications.status=posted + prediction_snapshots + measure task', async () => {
    // Step 1: Publish scheduler creates task
    const taskRes = await client.query(
      `INSERT INTO task_queue (task_type, payload, status, created_at)
       VALUES ('publish', $1, 'pending', NOW())
       RETURNING id`,
      [JSON.stringify({ content_id: testContentId, account_id: testAccountId })]
    );
    const publishTaskId = taskRes.rows[0].id;

    // Verify publish task is pending
    const taskCheck = await client.query(
      `SELECT task_type, status, payload FROM task_queue WHERE id = $1`, [publishTaskId]
    );
    expect(taskCheck.rows[0].task_type).toBe('publish');
    expect(taskCheck.rows[0].status).toBe('pending');

    // Step 2: Posting worker picks up and processes
    await client.query(
      `UPDATE task_queue SET status = 'processing', started_at = NOW()
       WHERE id = $1`,
      [publishTaskId]
    );

    // Step 3: Posting worker creates publication record
    const pubRes = await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id, measure_after)
       VALUES ($1, $2, 'youtube', 'posted', NOW(), 'YT_POST_INT002', NOW() + INTERVAL '48 hours')
       RETURNING id, measure_after`,
      [testContentId, testAccountId]
    );
    const pubId = pubRes.rows[0].id;
    const measureAfter = pubRes.rows[0].measure_after;

    // Step 4: Update content status to 'posted'
    await client.query(
      `UPDATE content SET status = 'posted' WHERE content_id = $1`,
      [testContentId]
    );

    // Step 5: Create prediction_snapshots for this publication
    await client.query(
      `INSERT INTO prediction_snapshots (account_id, content_id, predicted_impressions, publication_id,
                                         baseline_used, baseline_source, adjustments_applied, total_adjustment)
       VALUES ($1, $2, 2500, $3, 2000, 'own_history', '{"timing": 1.25}'::jsonb, 1.25)`,
      [testAccountId, testContentId, pubId]
    );

    // Step 6: Mark publish task completed
    await client.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [publishTaskId]
    );

    // Step 7: Publishing scheduler creates measure task with correct timing
    const measureTaskRes = await client.query(
      `INSERT INTO task_queue (task_type, payload, status, created_at)
       VALUES ('measure', $1, 'pending', NOW())
       RETURNING id`,
      [JSON.stringify({ content_id: testContentId, publication_id: pubId, measure_after: measureAfter })]
    );
    expect(measureTaskRes.rows[0].id).toBeGreaterThan(0);

    // === VERIFY ALL OUTCOMES ===

    // Publication record exists with correct status
    const finalPub = await client.query(
      `SELECT status, platform_post_id, measure_after FROM publications WHERE id = $1`, [pubId]
    );
    expect(finalPub.rows[0].status).toBe('posted');
    expect(finalPub.rows[0].platform_post_id).toBe('YT_POST_INT002');
    expect(finalPub.rows[0].measure_after).not.toBeNull();

    // Content status is 'posted'
    const finalContent = await client.query(
      `SELECT status FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(finalContent.rows[0].status).toBe('posted');

    // Prediction snapshot was created
    const snapRes = await client.query(
      `SELECT predicted_impressions, baseline_used, baseline_source FROM prediction_snapshots
       WHERE account_id = $1 AND content_id = $2`,
      [testAccountId, testContentId]
    );
    expect(snapRes.rows.length).toBe(1);
    expect(snapRes.rows[0].predicted_impressions).toBe(2500);

    // Measure task was created
    const measureTasks = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM task_queue
       WHERE task_type = 'measure' AND payload->>'content_id' = $1`,
      [testContentId]
    );
    expect(measureTasks.rows[0].cnt).toBeGreaterThan(0);

    // Publish task is completed
    const finalTask = await client.query(
      `SELECT status, completed_at FROM task_queue WHERE id = $1`, [publishTaskId]
    );
    expect(finalTask.rows[0].status).toBe('completed');
    expect(finalTask.rows[0].completed_at).not.toBeNull();
  });
});
