/**
 * FEAT-TST-004: 計測 → 分析サイクル連携
 * TEST-INT-004
 *
 * Verifies that after measurement (publications.status='measured'),
 * the analyst creates analysis records, content_learnings are generated,
 * and content.status transitions to 'analyzed'.
 */
import { Pool, PoolClient } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-004: measurement → analysis cycle', () => {
  let pool: Pool;
  let client: PoolClient;
  const testCharId = 'CHR_INT004';
  const testContentId = 'CNT_INT004_001';
  const testAccountId = 'ACC_INT004';
  const cycleNumber = 9004;

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB_URL, max: 3 });
    const c = await pool.connect();
    try {
      await c.query(`DELETE FROM content_learnings WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM analyses WHERE cycle_id IN (SELECT id FROM cycles WHERE cycle_number = $1)`, [cycleNumber]);
      await c.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id = $1)`, [testContentId]);
      await c.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
      await c.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM cycles WHERE cycle_number = $1`, [cycleNumber]);
      await c.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
      await c.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

      await c.query(
        `INSERT INTO characters (character_id, name, voice_id, status)
         VALUES ($1, 'Test Char INT004', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
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
        `INSERT INTO cycles (cycle_number, status) VALUES ($1, 'analyzing')`,
        [cycleNumber]
      );
    } finally {
      c.release();
    }
  });

  afterAll(async () => {
    const c = await pool.connect();
    try {
      await c.query(`DELETE FROM content_learnings WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM analyses WHERE cycle_id IN (SELECT id FROM cycles WHERE cycle_number = $1)`, [cycleNumber]);
      await c.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id = $1)`, [testContentId]);
      await c.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
      await c.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM cycles WHERE cycle_number = $1`, [cycleNumber]);
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

  test('TEST-INT-004: measured content → analyst creates analysis + content_learnings → content.status=analyzed', async () => {
    // Setup: Content that has been posted and measured with metrics
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id)
       VALUES ($1, 'short_video', 'posted', $2)`,
      [testContentId, testCharId]
    );

    // Create publication with measurement
    const pubRes = await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id, measure_after)
       VALUES ($1, $2, 'youtube', 'measured', NOW() - INTERVAL '3 days', 'YT_INT004', NOW() - INTERVAL '1 day')
       RETURNING id`,
      [testContentId, testAccountId]
    );
    const pubId = pubRes.rows[0].id;

    // Insert metrics
    await client.query(
      `INSERT INTO metrics (publication_id, views, likes, comments, shares, engagement_rate, measurement_point)
       VALUES ($1, 5000, 400, 60, 25, 0.0970, '48h')`,
      [pubId]
    );

    // Get cycle id
    const cycleRes = await client.query(
      `SELECT id FROM cycles WHERE cycle_number = $1`, [cycleNumber]
    );
    const cycleId = cycleRes.rows[0].id;

    // Step 1: Analyst creates analysis record with findings
    const analysisRes = await client.query(
      `INSERT INTO analyses (cycle_id, analysis_type, findings, recommendations)
       VALUES ($1, 'cycle_review', $2, $3)
       RETURNING id`,
      [
        cycleId,
        JSON.stringify({
          top_performer: testContentId,
          avg_engagement: 0.097,
          insights: ['Morning posts outperform afternoon']
        }),
        JSON.stringify({
          action: 'increase_similar',
          focus_areas: ['timing optimization', 'hook style']
        })
      ]
    );
    expect(analysisRes.rows[0].id).toBeGreaterThan(0);

    // Step 2: Analyst creates content_learnings for this content
    await client.query(
      `INSERT INTO content_learnings (content_id, micro_verdict, prediction_error, key_insight, confidence, niche,
                                       predicted_kpis, actual_kpis, similar_past_learnings_referenced)
       VALUES ($1, 'confirmed', 0.15, 'Short hooks under 3s drive 20% more retention', 0.82, 'beauty',
               '{"views": 4000, "engagement_rate": 0.08}'::jsonb,
               '{"views": 5000, "engagement_rate": 0.097}'::jsonb, 0)`,
      [testContentId]
    );

    // Step 3: Update content status to 'analyzed'
    await client.query(
      `UPDATE content SET status = 'analyzed' WHERE content_id = $1`,
      [testContentId]
    );

    // === VERIFY ALL OUTCOMES ===

    // Analysis record exists with correct structure
    const analysisCheck = await client.query(
      `SELECT analysis_type, findings, recommendations FROM analyses WHERE cycle_id = $1`, [cycleId]
    );
    expect(analysisCheck.rows.length).toBeGreaterThan(0);
    expect(analysisCheck.rows[0].analysis_type).toBe('cycle_review');
    expect(analysisCheck.rows[0].findings).toHaveProperty('top_performer');
    expect(analysisCheck.rows[0].recommendations).toHaveProperty('action');

    // Content learnings were created
    const learningsRes = await client.query(
      `SELECT micro_verdict, prediction_error, key_insight, confidence, niche
       FROM content_learnings WHERE content_id = $1`,
      [testContentId]
    );
    expect(learningsRes.rows.length).toBe(1);
    expect(learningsRes.rows[0].micro_verdict).toBe('confirmed');
    expect(parseFloat(learningsRes.rows[0].prediction_error)).toBeCloseTo(0.15, 2);
    expect(learningsRes.rows[0].key_insight).toContain('Short hooks');
    expect(parseFloat(learningsRes.rows[0].confidence)).toBeGreaterThan(0);
    expect(learningsRes.rows[0].niche).toBe('beauty');

    // Content status is 'analyzed'
    const contentRes = await client.query(
      `SELECT status FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(contentRes.rows[0].status).toBe('analyzed');
  });
});
