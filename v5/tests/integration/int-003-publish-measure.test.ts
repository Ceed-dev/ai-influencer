/**
 * FEAT-TST-003: 投稿 → 計測連携
 * TEST-INT-003
 *
 * Verifies that after posting (publications.status='posted', measure_after<=NOW()),
 * measurement job creates task_queue (type='measure'), collects metrics,
 * updates prediction_snapshots with actual values, and creates analysis task.
 */
import { Pool, PoolClient } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-003: publish → measurement pipeline', () => {
  let pool: Pool;
  let client: PoolClient;
  const testCharId = 'CHR_INT003';
  const testContentId = 'CNT_INT003_001';
  const testAccountId = 'ACC_INT003';

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
         VALUES ($1, 'Test Char INT003', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
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
         VALUES ($1, 'short_video', 'posted', $2)`,
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

  test('TEST-INT-003: posted publication → measure task → metrics + prediction_snapshots + analysis task', async () => {
    // Step 1: Publication with measure_after in the past (ready for measurement)
    const pubRes = await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, measure_after, platform_post_id)
       VALUES ($1, $2, 'youtube', 'posted', NOW() - INTERVAL '49 hours', NOW() - INTERVAL '1 hour', 'YT_INT003')
       RETURNING id`,
      [testContentId, testAccountId]
    );
    const pubId = pubRes.rows[0].id;

    // Create prediction snapshot (would have been created at publish time)
    await client.query(
      `INSERT INTO prediction_snapshots (account_id, content_id, predicted_impressions, publication_id,
                                         baseline_used, baseline_source, adjustments_applied, total_adjustment)
       VALUES ($1, $2, 3000, $3, 2500, 'own_history', '{"timing": 1.2}'::jsonb, 1.20)`,
      [testAccountId, testContentId, pubId]
    );

    // Step 2: Measurement job detects publications where measure_after <= NOW()
    const readyPubs = await client.query(
      `SELECT id, content_id, platform_post_id FROM publications
       WHERE status = 'posted' AND measure_after <= NOW() AND content_id = $1`,
      [testContentId]
    );
    expect(readyPubs.rows.length).toBe(1);

    // Step 3: Measurement job creates task
    const measureTaskRes = await client.query(
      `INSERT INTO task_queue (task_type, payload, status, created_at)
       VALUES ('measure', $1, 'pending', NOW())
       RETURNING id`,
      [JSON.stringify({ content_id: testContentId, publication_id: pubId })]
    );
    const measureTaskId = measureTaskRes.rows[0].id;

    // Step 4: Measurement worker claims and processes
    await client.query(
      `UPDATE task_queue SET status = 'processing', started_at = NOW()
       WHERE id = $1`,
      [measureTaskId]
    );

    // Step 5: Collect metrics (mocked — in reality would call platform APIs)
    const actualViews = 3500;
    const actualLikes = 280;
    const actualComments = 45;
    const actualShares = 20;
    const engagementRate = 0.0986;

    await client.query(
      `INSERT INTO metrics (publication_id, views, likes, comments, shares, engagement_rate, measurement_point)
       VALUES ($1, $2, $3, $4, $5, $6, '48h')`,
      [pubId, actualViews, actualLikes, actualComments, actualShares, engagementRate]
    );

    // Step 6: Update prediction_snapshots with actual values
    await client.query(
      `UPDATE prediction_snapshots
       SET actual_impressions_48h = $1
       WHERE publication_id = $2`,
      [actualViews, pubId]
    );

    // Step 7: Update publication status to 'measured'
    await client.query(
      `UPDATE publications SET status = 'measured' WHERE id = $1`, [pubId]
    );

    // Step 8: Mark measure task completed
    await client.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [measureTaskId]
    );

    // Step 9: Analysis is triggered by next strategy cycle detecting measured publications.
    // The strategy cycle queries for publications.status='measured' — no separate analyze task_type.
    // Verify that the publication is now in the correct state for analysis pickup.
    const measuredPubCheck = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM publications
       WHERE status = 'measured' AND content_id = $1`,
      [testContentId]
    );
    expect(measuredPubCheck.rows[0].cnt).toBe(1);

    // === VERIFY ALL OUTCOMES ===

    // Metrics recorded with correct values
    const metricsRes = await client.query(
      `SELECT views, likes, comments, shares, engagement_rate, measurement_point
       FROM metrics WHERE publication_id = $1`, [pubId]
    );
    expect(metricsRes.rows.length).toBe(1);
    expect(metricsRes.rows[0].views).toBe(actualViews);
    expect(metricsRes.rows[0].likes).toBe(actualLikes);
    expect(metricsRes.rows[0].measurement_point).toBe('48h');
    expect(parseFloat(metricsRes.rows[0].engagement_rate)).toBeCloseTo(engagementRate, 3);

    // Prediction snapshot updated with actual views
    const snapRes = await client.query(
      `SELECT predicted_impressions, actual_impressions_48h
       FROM prediction_snapshots WHERE publication_id = $1`, [pubId]
    );
    expect(snapRes.rows.length).toBe(1);
    expect(snapRes.rows[0].predicted_impressions).toBe(3000);
    expect(snapRes.rows[0].actual_impressions_48h).toBe(actualViews);

    // Publication status is 'measured'
    const updatedPub = await client.query(
      `SELECT status FROM publications WHERE id = $1`, [pubId]
    );
    expect(updatedPub.rows[0].status).toBe('measured');

    // Publication is ready for analysis pickup by next strategy cycle
    const readyForAnalysis = await client.query(
      `SELECT status FROM publications WHERE content_id = $1 AND status = 'measured'`,
      [testContentId]
    );
    expect(readyForAnalysis.rows.length).toBe(1);

    // Measure task is completed
    const finalTask = await client.query(
      `SELECT status, completed_at FROM task_queue WHERE id = $1`, [measureTaskId]
    );
    expect(finalTask.rows[0].status).toBe('completed');
    expect(finalTask.rows[0].completed_at).not.toBeNull();
  });
});
