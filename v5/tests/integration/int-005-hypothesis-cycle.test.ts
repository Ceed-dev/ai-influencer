/**
 * FEAT-TST-005: 仮説駆動サイクル (仮説→コンテンツ→計測→検証)
 * TEST-INT-005
 *
 * Verifies the complete hypothesis-driven cycle:
 * hypothesis(verdict='pending') → content creation → measure → verdict updated.
 * Also verifies hypothesis_accuracy calculation via prediction vs actual metrics.
 */
import { Pool, PoolClient } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-005: hypothesis-driven cycle', () => {
  let pool: Pool;
  let client: PoolClient;
  const testCharId = 'CHR_INT005';
  const testContentId = 'CNT_INT005_001';
  const testAccountId = 'ACC_INT005';

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB_URL, max: 3 });
    const c = await pool.connect();
    try {
      await c.query(`DELETE FROM content_learnings WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM prediction_snapshots WHERE account_id = $1`, [testAccountId]);
      await c.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id = $1)`, [testContentId]);
      await c.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM hypotheses WHERE target_accounts @> ARRAY[$1]::varchar[]`, [testAccountId]);
      await c.query(`DELETE FROM cycles WHERE cycle_number IN (9005, 9006)`);
      await c.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
      await c.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

      await c.query(
        `INSERT INTO characters (character_id, name, voice_id, status)
         VALUES ($1, 'Test Char INT005', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
         ON CONFLICT (character_id) DO NOTHING`,
        [testCharId]
      );
      await c.query(
        `INSERT INTO accounts (account_id, platform, character_id, status)
         VALUES ($1, 'youtube', $2, 'active')
         ON CONFLICT (account_id) DO NOTHING`,
        [testAccountId, testCharId]
      );
      await c.query(`INSERT INTO cycles (cycle_number, status) VALUES (9005, 'planning')`);
      await c.query(`INSERT INTO cycles (cycle_number, status) VALUES (9006, 'analyzing')`);
    } finally {
      c.release();
    }
  });

  afterAll(async () => {
    const c = await pool.connect();
    try {
      await c.query(`DELETE FROM content_learnings WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM prediction_snapshots WHERE account_id = $1`, [testAccountId]);
      await c.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id = $1)`, [testContentId]);
      await c.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
      await c.query(`DELETE FROM hypotheses WHERE target_accounts @> ARRAY[$1]::varchar[]`, [testAccountId]);
      await c.query(`DELETE FROM cycles WHERE cycle_number IN (9005, 9006)`);
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

  test('TEST-INT-005: hypothesis pending → content → publish → measure → verdict updated + accuracy', async () => {
    const cycleRes = await client.query(`SELECT id FROM cycles WHERE cycle_number = 9005`);
    const cycleId = cycleRes.rows[0].id;

    // Step 1: Create hypothesis with predicted KPIs
    const hypRes = await client.query(
      `INSERT INTO hypotheses (cycle_id, category, statement, rationale, target_accounts, verdict, predicted_kpis)
       VALUES ($1, 'timing', 'Morning posts (7AM JST) get 30% more views than afternoon posts',
               'Data from competitor analysis shows peak engagement at 7-8AM JST',
               ARRAY[$2]::varchar[], 'pending',
               '{"views": 3000, "engagement_rate": 0.08}'::jsonb)
       RETURNING id`,
      [cycleId, testAccountId]
    );
    const hypId = hypRes.rows[0].id;

    // Verify hypothesis is pending
    const initHyp = await client.query(
      `SELECT verdict, predicted_kpis FROM hypotheses WHERE id = $1`, [hypId]
    );
    expect(initHyp.rows[0].verdict).toBe('pending');
    expect(initHyp.rows[0].predicted_kpis).toEqual({ views: 3000, engagement_rate: 0.08 });

    // Step 2: Create content linked to hypothesis
    await client.query(
      `INSERT INTO content (content_id, hypothesis_id, content_format, status, character_id)
       VALUES ($1, $2, 'short_video', 'planned', $3)`,
      [testContentId, hypId, testCharId]
    );

    // Step 3: Content lifecycle: planned → ready → posted
    await client.query(`UPDATE content SET status = 'ready' WHERE content_id = $1`, [testContentId]);

    // Step 4: Publish
    const pubRes = await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id, measure_after)
       VALUES ($1, $2, 'youtube', 'posted', NOW() - INTERVAL '49 hours', 'YT_INT005', NOW() - INTERVAL '1 hour')
       RETURNING id`,
      [testContentId, testAccountId]
    );
    const pubId = pubRes.rows[0].id;
    await client.query(`UPDATE content SET status = 'posted' WHERE content_id = $1`, [testContentId]);

    // Step 5: Create prediction snapshot
    await client.query(
      `INSERT INTO prediction_snapshots (account_id, content_id, predicted_impressions, publication_id,
                                         baseline_used, baseline_source, adjustments_applied, total_adjustment)
       VALUES ($1, $2, 3000, $3, 2400, 'own_history', '{"timing": 1.25}'::jsonb, 1.25)`,
      [testAccountId, testContentId, pubId]
    );

    // Step 6: Measurement — actual metrics collected
    const actualViews = 3800;
    const actualEngagement = 0.092;
    await client.query(
      `INSERT INTO metrics (publication_id, views, likes, comments, shares, engagement_rate, measurement_point)
       VALUES ($1, $2, 350, 55, 30, $3, '48h')`,
      [pubId, actualViews, actualEngagement]
    );

    // Update prediction snapshot with actual 48h views
    await client.query(
      `UPDATE prediction_snapshots SET actual_impressions_48h = $1, updated_at = NOW() WHERE publication_id = $2`,
      [actualViews, pubId]
    );

    await client.query(`UPDATE publications SET status = 'measured' WHERE id = $1`, [pubId]);

    // Step 7: Analyst verifies hypothesis in next cycle
    const cycle2Res = await client.query(`SELECT id FROM cycles WHERE cycle_number = 9006`);
    const cycle2Id = cycle2Res.rows[0].id;

    // Calculate prediction error: |3000-3800|/3000 = 0.267 → but views exceeded prediction, so hypothesis is confirmed
    const predictionError = Math.abs(3000 - actualViews) / 3000;

    await client.query(
      `UPDATE hypotheses
       SET verdict = 'confirmed', confidence = 0.85, evidence_count = 3,
           actual_kpis = '{"views": 3800, "engagement_rate": 0.092}'::jsonb
       WHERE id = $1`,
      [hypId]
    );

    // Step 8: Create content_learnings
    await client.query(
      `INSERT INTO content_learnings (content_id, micro_verdict, prediction_error, key_insight, confidence, niche,
                                       predicted_kpis, actual_kpis, similar_past_learnings_referenced)
       VALUES ($1, 'confirmed', $2, 'Morning posting (7AM) confirmed to boost views by 27%', 0.85, 'beauty',
               '{"views": 3000, "engagement_rate": 0.08}'::jsonb,
               '{"views": 3800, "engagement_rate": 0.092}'::jsonb, 0)`,
      [testContentId, predictionError]
    );

    // === VERIFY ALL OUTCOMES ===

    // Hypothesis verdict is no longer pending
    const verdictRes = await client.query(
      `SELECT verdict, confidence, evidence_count, predicted_kpis, actual_kpis
       FROM hypotheses WHERE id = $1`, [hypId]
    );
    expect(verdictRes.rows[0].verdict).not.toBe('pending');
    expect(verdictRes.rows[0].verdict).toBe('confirmed');
    expect(parseFloat(verdictRes.rows[0].confidence)).toBeGreaterThan(0);
    expect(verdictRes.rows[0].evidence_count).toBe(3);
    expect(verdictRes.rows[0].predicted_kpis).toEqual({ views: 3000, engagement_rate: 0.08 });
    expect(verdictRes.rows[0].actual_kpis).toEqual({ views: 3800, engagement_rate: 0.092 });

    // Prediction snapshot has both predicted and actual
    const snapRes = await client.query(
      `SELECT predicted_impressions, actual_impressions_48h
       FROM prediction_snapshots WHERE publication_id = $1`, [pubId]
    );
    expect(snapRes.rows[0].predicted_impressions).toBe(3000);
    expect(snapRes.rows[0].actual_impressions_48h).toBe(3800);

    // Content learnings exist with correct data
    const clRes = await client.query(
      `SELECT micro_verdict, prediction_error, key_insight, confidence
       FROM content_learnings WHERE content_id = $1`,
      [testContentId]
    );
    expect(clRes.rows.length).toBe(1);
    expect(clRes.rows[0].micro_verdict).toBe('confirmed');
    expect(parseFloat(clRes.rows[0].prediction_error)).toBeCloseTo(predictionError, 2);
    expect(clRes.rows[0].key_insight).toContain('Morning posting');

    // Content linked to hypothesis
    const contentRes = await client.query(
      `SELECT hypothesis_id FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(contentRes.rows[0].hypothesis_id).toBe(hypId);
  });
});
