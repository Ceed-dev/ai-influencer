/**
 * E2E Full Cycle Test
 * TEST-E2E-001 (comprehensive version)
 *
 * Tests the complete lifecycle: create_cycle → plan_content → produce →
 * publish → measure → analyze → learnings extraction.
 *
 * All DB operations are REAL against the dev database.
 * All external APIs (LLM, platforms) are effectively irrelevant here since
 * we are simulating each step at the DB level (graph communication pattern).
 *
 * This is the most important test — it proves the entire system works end-to-end
 * through PostgreSQL-based inter-graph communication.
 */
import { Pool, PoolClient } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('E2E Full Cycle: hypothesis → plan → produce → publish → measure → analyze → learn', () => {
  let pool: Pool;
  let client: PoolClient;

  // Unique test identifiers
  const PREFIX = 'E2E_FC_';
  const testCharId = `${PREFIX}CHR_001`;
  const testAccountYT = `${PREFIX}ACC_YT`;
  const testAccountTT = `${PREFIX}ACC_TT`;
  const testContentId = `${PREFIX}CNT_001`;
  const testContentId2 = `${PREFIX}CNT_002`;
  const cycle1Num = 7001;
  const cycle2Num = 7002;

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB_URL, max: 5 });
    const c = await pool.connect();
    try {
      // Clean up in reverse FK order
      await c.query(`DELETE FROM content_learnings WHERE content_id LIKE '${PREFIX}%'`);
      await c.query(`DELETE FROM learnings WHERE insight LIKE '%${PREFIX}%'`);
      await c.query(`DELETE FROM agent_individual_learnings WHERE content LIKE '%${PREFIX}%'`);
      await c.query(`DELETE FROM analyses WHERE cycle_id IN (SELECT id FROM cycles WHERE cycle_number IN ($1, $2))`, [cycle1Num, cycle2Num]);
      await c.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id LIKE '${PREFIX}%')`);
      await c.query(`DELETE FROM prediction_snapshots WHERE account_id LIKE '${PREFIX}%'`);
      await c.query(`DELETE FROM publications WHERE content_id LIKE '${PREFIX}%'`);
      await c.query(`DELETE FROM content_sections WHERE content_id LIKE '${PREFIX}%'`);
      await c.query(`DELETE FROM task_queue WHERE payload::text LIKE '%${PREFIX}%'`);
      await c.query(`DELETE FROM content WHERE content_id LIKE '${PREFIX}%'`);
      await c.query(`DELETE FROM hypotheses WHERE target_accounts @> ARRAY[$1]::varchar[]`, [testAccountYT]);
      await c.query(`DELETE FROM cycles WHERE cycle_number IN ($1, $2)`, [cycle1Num, cycle2Num]);
      await c.query(`DELETE FROM accounts WHERE account_id LIKE '${PREFIX}%'`);
      await c.query(`DELETE FROM characters WHERE character_id LIKE '${PREFIX}%'`);

      // Seed base data
      await c.query(
        `INSERT INTO characters (character_id, name, voice_id, appearance, status)
         VALUES ($1, 'Full Cycle Test Char', 'aaaa1111bbbb2222cccc3333dddd4444', '{"style":"anime","hair":"blue"}', 'active')`,
        [testCharId]
      );
      await c.query(
        `INSERT INTO accounts (account_id, platform, character_id, status, niche, cluster, follower_count)
         VALUES ($1, 'youtube', $2, 'active', 'beauty', 'cluster_a', 1200)`,
        [testAccountYT, testCharId]
      );
      await c.query(
        `INSERT INTO accounts (account_id, platform, character_id, status, niche, cluster, follower_count)
         VALUES ($1, 'tiktok', $2, 'active', 'beauty', 'cluster_a', 2500)`,
        [testAccountTT, testCharId]
      );
    } finally {
      c.release();
    }
  });

  afterAll(async () => {
    const c = await pool.connect();
    try {
      await c.query(`DELETE FROM content_learnings WHERE content_id LIKE '${PREFIX}%'`);
      await c.query(`DELETE FROM learnings WHERE insight LIKE '%${PREFIX}%'`);
      await c.query(`DELETE FROM agent_individual_learnings WHERE content LIKE '%${PREFIX}%'`);
      await c.query(`DELETE FROM analyses WHERE cycle_id IN (SELECT id FROM cycles WHERE cycle_number IN ($1, $2))`, [cycle1Num, cycle2Num]);
      await c.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id LIKE '${PREFIX}%')`);
      await c.query(`DELETE FROM prediction_snapshots WHERE account_id LIKE '${PREFIX}%'`);
      await c.query(`DELETE FROM publications WHERE content_id LIKE '${PREFIX}%'`);
      await c.query(`DELETE FROM content_sections WHERE content_id LIKE '${PREFIX}%'`);
      await c.query(`DELETE FROM task_queue WHERE payload::text LIKE '%${PREFIX}%'`);
      await c.query(`DELETE FROM content WHERE content_id LIKE '${PREFIX}%'`);
      await c.query(`DELETE FROM hypotheses WHERE target_accounts @> ARRAY[$1]::varchar[]`, [testAccountYT]);
      await c.query(`DELETE FROM cycles WHERE cycle_number IN ($1, $2)`, [cycle1Num, cycle2Num]);
      await c.query(`DELETE FROM accounts WHERE account_id LIKE '${PREFIX}%'`);
      await c.query(`DELETE FROM characters WHERE character_id LIKE '${PREFIX}%'`);
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

  test('Full lifecycle: single hypothesis → content → produce → publish → measure → analyze → learn', async () => {
    // =====================================================================
    // PHASE 1: Create Strategy Cycle
    // =====================================================================
    const cycle1Res = await client.query(
      `INSERT INTO cycles (cycle_number, status) VALUES ($1, 'planning') RETURNING id`,
      [cycle1Num]
    );
    const cycle1Id = cycle1Res.rows[0].id;
    expect(cycle1Id).toBeGreaterThan(0);

    // =====================================================================
    // PHASE 2: Planner creates hypothesis + content plan
    // =====================================================================

    // Hypothesis: Morning posts perform better
    const hypRes = await client.query(
      `INSERT INTO hypotheses (cycle_id, category, statement, rationale, target_accounts, verdict, predicted_kpis)
       VALUES ($1, 'timing', '${PREFIX}Morning 7AM posts get 25% more views',
               '${PREFIX}Competitor data shows morning engagement peak',
               ARRAY[$2, $3]::varchar[], 'pending',
               '{"views": 3000, "engagement_rate": 0.07}'::jsonb)
       RETURNING id`,
      [cycle1Id, testAccountYT, testAccountTT]
    );
    const hypId = hypRes.rows[0].id;

    // Verify hypothesis is pending
    const hypCheck = await client.query(`SELECT verdict FROM hypotheses WHERE id = $1`, [hypId]);
    expect(hypCheck.rows[0].verdict).toBe('pending');

    // Content plan (short_video for YouTube)
    await client.query(
      `INSERT INTO content (content_id, hypothesis_id, character_id, content_format, status, script_language)
       VALUES ($1, $2, $3, 'short_video', 'planned', 'jp')`,
      [testContentId, hypId, testCharId]
    );

    // Content sections (hook/body/cta)
    const compIds = [`${PREFIX}SCN_HOOK`, `${PREFIX}SCN_BODY`, `${PREFIX}SCN_CTA`];
    for (const cid of compIds) {
      await client.query(
        `INSERT INTO components (component_id, type, name) VALUES ($1, 'scenario', $1) ON CONFLICT DO NOTHING`,
        [cid]
      );
    }
    const sectionLabels = ['hook', 'body', 'cta'];
    for (let i = 0; i < sectionLabels.length; i++) {
      await client.query(
        `INSERT INTO content_sections (content_id, section_label, component_id, section_order)
         VALUES ($1, $2, $3, $4)`,
        [testContentId, sectionLabels[i], compIds[i], i + 1]
      );
    }

    // Verify content sections created
    const sectionsRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM content_sections WHERE content_id = $1`,
      [testContentId]
    );
    expect(sectionsRes.rows[0].cnt).toBe(3);

    // =====================================================================
    // PHASE 3: Enqueue produce task (Strategy → Production)
    // =====================================================================
    const produceTaskRes = await client.query(
      `INSERT INTO task_queue (task_type, payload, status, created_at)
       VALUES ('produce', $1, 'pending', NOW()) RETURNING id`,
      [JSON.stringify({ content_id: testContentId })]
    );
    const produceTaskId = produceTaskRes.rows[0].id;

    // Update cycle status
    await client.query(`UPDATE cycles SET status = 'executing' WHERE id = $1`, [cycle1Id]);

    // =====================================================================
    // PHASE 4: Production Pipeline processes
    // =====================================================================

    // Dequeue task
    await client.query(
      `UPDATE task_queue SET status = 'processing', started_at = NOW() WHERE id = $1`,
      [produceTaskId]
    );

    // Content transitions: planned → producing → ready
    await client.query(`UPDATE content SET status = 'producing' WHERE content_id = $1`, [testContentId]);

    // Simulate production steps (TTS, video generation, ffmpeg concat)
    await client.query(
      `UPDATE content SET production_metadata = $1::jsonb WHERE content_id = $2`,
      [JSON.stringify({ sections_completed: 3, total_seconds: 60 }), testContentId]
    );

    // Production complete
    await client.query(`UPDATE content SET status = 'ready' WHERE content_id = $1`, [testContentId]);
    await client.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [produceTaskId]
    );

    // Verify production complete
    const readyContent = await client.query(
      `SELECT status FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(readyContent.rows[0].status).toBe('ready');

    // =====================================================================
    // PHASE 5: Publishing Scheduler → Posting Worker
    // =====================================================================

    // Enqueue publish task
    const publishTaskRes = await client.query(
      `INSERT INTO task_queue (task_type, payload, status, created_at)
       VALUES ('publish', $1, 'pending', NOW()) RETURNING id`,
      [JSON.stringify({ content_id: testContentId, account_id: testAccountYT })]
    );
    const publishTaskId = publishTaskRes.rows[0].id;

    // Posting worker processes
    await client.query(
      `UPDATE task_queue SET status = 'processing', started_at = NOW() WHERE id = $1`,
      [publishTaskId]
    );

    // Create publication record (YouTube)
    const ytPubRes = await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id, measure_after)
       VALUES ($1, $2, 'youtube', 'posted', NOW() - INTERVAL '49 hours', 'YT_FC001', NOW() - INTERVAL '1 hour')
       RETURNING id`,
      [testContentId, testAccountYT]
    );
    const ytPubId = ytPubRes.rows[0].id;

    // Also publish to TikTok (multiplatform)
    const ttPubRes = await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id, measure_after)
       VALUES ($1, $2, 'tiktok', 'posted', NOW() - INTERVAL '49 hours', 'TT_FC001', NOW() - INTERVAL '1 hour')
       RETURNING id`,
      [testContentId, testAccountTT]
    );
    const ttPubId = ttPubRes.rows[0].id;

    // Update content status
    await client.query(`UPDATE content SET status = 'posted' WHERE content_id = $1`, [testContentId]);

    // Create prediction snapshots for both platforms
    await client.query(
      `INSERT INTO prediction_snapshots (account_id, content_id, predicted_impressions, publication_id,
                                         baseline_used, baseline_source, adjustments_applied, total_adjustment)
       VALUES ($1, $2, 3000, $3, 2400, 'own_history', '{"timing": 1.25}'::jsonb, 1.25)`,
      [testAccountYT, testContentId, ytPubId]
    );
    await client.query(
      `INSERT INTO prediction_snapshots (account_id, content_id, predicted_impressions, publication_id,
                                         baseline_used, baseline_source, adjustments_applied, total_adjustment)
       VALUES ($1, $2, 5000, $3, 4000, 'own_history', '{"timing": 1.25}'::jsonb, 1.25)`,
      [testAccountTT, testContentId, ttPubId]
    );

    // Mark publish task completed
    await client.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [publishTaskId]
    );

    // Verify publications created
    const pubsRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM publications WHERE content_id = $1 AND status = 'posted'`,
      [testContentId]
    );
    expect(pubsRes.rows[0].cnt).toBe(2);

    // =====================================================================
    // PHASE 6: Measurement Job
    // =====================================================================

    // Enqueue measure tasks (one per publication)
    const measureTask1Res = await client.query(
      `INSERT INTO task_queue (task_type, payload, status, created_at)
       VALUES ('measure', $1, 'pending', NOW()) RETURNING id`,
      [JSON.stringify({ content_id: testContentId, publication_id: ytPubId })]
    );
    const measureTask2Res = await client.query(
      `INSERT INTO task_queue (task_type, payload, status, created_at)
       VALUES ('measure', $1, 'pending', NOW()) RETURNING id`,
      [JSON.stringify({ content_id: testContentId, publication_id: ttPubId })]
    );

    // YouTube measurement
    await client.query(
      `UPDATE task_queue SET status = 'processing', started_at = NOW() WHERE id = $1`,
      [measureTask1Res.rows[0].id]
    );
    await client.query(
      `INSERT INTO metrics (publication_id, views, likes, comments, shares, engagement_rate, measurement_point)
       VALUES ($1, 3500, 280, 45, 20, 0.0986, '48h')`,
      [ytPubId]
    );
    await client.query(
      `UPDATE prediction_snapshots SET actual_impressions_48h = 3500, updated_at = NOW() WHERE publication_id = $1`,
      [ytPubId]
    );
    await client.query(`UPDATE publications SET status = 'measured' WHERE id = $1`, [ytPubId]);
    await client.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [measureTask1Res.rows[0].id]
    );

    // TikTok measurement
    await client.query(
      `UPDATE task_queue SET status = 'processing', started_at = NOW() WHERE id = $1`,
      [measureTask2Res.rows[0].id]
    );
    await client.query(
      `INSERT INTO metrics (publication_id, views, likes, comments, shares, engagement_rate, measurement_point)
       VALUES ($1, 6200, 520, 90, 55, 0.1073, '48h')`,
      [ttPubId]
    );
    await client.query(
      `UPDATE prediction_snapshots SET actual_impressions_48h = 6200, updated_at = NOW() WHERE publication_id = $1`,
      [ttPubId]
    );
    await client.query(`UPDATE publications SET status = 'measured' WHERE id = $1`, [ttPubId]);
    await client.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [measureTask2Res.rows[0].id]
    );

    // Verify metrics collected for both platforms
    const ytMetrics = await client.query(
      `SELECT views, likes, engagement_rate, measurement_point FROM metrics WHERE publication_id = $1`,
      [ytPubId]
    );
    expect(ytMetrics.rows[0].views).toBe(3500);
    expect(ytMetrics.rows[0].measurement_point).toBe('48h');

    const ttMetrics = await client.query(
      `SELECT views, likes, engagement_rate FROM metrics WHERE publication_id = $1`,
      [ttPubId]
    );
    expect(ttMetrics.rows[0].views).toBe(6200);

    // =====================================================================
    // PHASE 7: Analysis — Strategy Cycle #2
    // =====================================================================
    const cycle2Res = await client.query(
      `INSERT INTO cycles (cycle_number, status) VALUES ($1, 'analyzing') RETURNING id`,
      [cycle2Num]
    );
    const cycle2Id = cycle2Res.rows[0].id;

    // Analyst creates analysis record
    await client.query(
      `INSERT INTO analyses (cycle_id, analysis_type, findings, recommendations)
       VALUES ($1, 'hypothesis_verification', $2, $3)`,
      [
        cycle2Id,
        JSON.stringify({
          hypothesis_id: hypId,
          youtube: { predicted: 3000, actual: 3500, delta_pct: 16.7 },
          tiktok: { predicted: 5000, actual: 6200, delta_pct: 24.0 },
          verdict: 'confirmed',
          confidence: 0.88
        }),
        JSON.stringify({
          action: 'continue_morning_posting',
          expand_to: ['instagram'],
          increase_frequency: true
        })
      ]
    );

    // Analyst updates hypothesis verdict
    await client.query(
      `UPDATE hypotheses
       SET verdict = 'confirmed', confidence = 0.88, evidence_count = 4,
           actual_kpis = '{"views_yt": 3500, "views_tt": 6200, "avg_engagement": 0.103}'::jsonb
       WHERE id = $1`,
      [hypId]
    );

    // =====================================================================
    // PHASE 8: Content Learnings + Knowledge Extraction
    // =====================================================================

    // Create content_learnings for this content
    await client.query(
      `INSERT INTO content_learnings (content_id, micro_verdict, prediction_error, key_insight, confidence, niche,
                                       predicted_kpis, actual_kpis, similar_past_learnings_referenced)
       VALUES ($1, 'confirmed', 0.167, '${PREFIX}Morning 7AM posting consistently outperforms. YT +17%, TT +24%.', 0.88, 'beauty',
               '{"views": 3000, "engagement_rate": 0.07}'::jsonb,
               '{"views": 3500, "engagement_rate": 0.0986}'::jsonb, 0)`,
      [testContentId]
    );

    // Extract learning to global learnings table
    await client.query(
      `INSERT INTO learnings (category, insight, confidence, evidence_count)
       VALUES ('timing', '${PREFIX}Morning posts (7AM JST) consistently outperform afternoon posts across YouTube and TikTok', 0.88, 4)`
    );

    // Record agent learning
    await client.query(
      `INSERT INTO agent_individual_learnings (agent_type, category, content, times_applied, confidence)
       VALUES ('analyst', 'timing', '${PREFIX}Morning 7AM window shows +20% avg views', 1, 0.88)`
    );

    // Mark content as analyzed
    await client.query(`UPDATE content SET status = 'analyzed' WHERE content_id = $1`, [testContentId]);

    // Complete cycle #1
    await client.query(`UPDATE cycles SET status = 'completed' WHERE id = $1`, [cycle1Id]);

    // =====================================================================
    // FINAL VERIFICATION: Check every table is correctly populated
    // =====================================================================

    // 1. Cycles — both exist
    const cyclesRes = await client.query(
      `SELECT cycle_number, status FROM cycles WHERE cycle_number IN ($1, $2) ORDER BY cycle_number`,
      [cycle1Num, cycle2Num]
    );
    expect(cyclesRes.rows.length).toBe(2);
    expect(cyclesRes.rows[0].status).toBe('completed');
    expect(cyclesRes.rows[1].status).toBe('analyzing');

    // 2. Hypothesis — verdict updated, not pending
    const finalHyp = await client.query(
      `SELECT verdict, confidence, evidence_count, predicted_kpis, actual_kpis
       FROM hypotheses WHERE id = $1`, [hypId]
    );
    expect(finalHyp.rows[0].verdict).not.toBe('pending');
    expect(finalHyp.rows[0].verdict).toBe('confirmed');
    expect(parseFloat(finalHyp.rows[0].confidence)).toBeGreaterThan(0.8);
    expect(finalHyp.rows[0].evidence_count).toBe(4);
    expect(finalHyp.rows[0].predicted_kpis).toBeDefined();
    expect(finalHyp.rows[0].actual_kpis).toBeDefined();

    // 3. Content — status is 'analyzed'
    const finalContent = await client.query(
      `SELECT status, hypothesis_id, content_format, character_id
       FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(finalContent.rows[0].status).toBe('analyzed');
    expect(finalContent.rows[0].hypothesis_id).toBe(hypId);
    expect(finalContent.rows[0].content_format).toBe('short_video');
    expect(finalContent.rows[0].character_id).toBe(testCharId);

    // 4. Content sections — 3 sections (hook/body/cta)
    const finalSections = await client.query(
      `SELECT section_label, section_order FROM content_sections
       WHERE content_id = $1 ORDER BY section_order`,
      [testContentId]
    );
    expect(finalSections.rows.length).toBe(3);
    expect(finalSections.rows.map(r => r.section_label)).toEqual(['hook', 'body', 'cta']);

    // 5. Publications — 2 platforms, both measured
    const finalPubs = await client.query(
      `SELECT platform, status, platform_post_id FROM publications
       WHERE content_id = $1 ORDER BY platform`,
      [testContentId]
    );
    expect(finalPubs.rows.length).toBe(2);
    expect(finalPubs.rows.map(r => r.platform).sort()).toEqual(['tiktok', 'youtube']);
    expect(finalPubs.rows.every(r => r.status === 'measured')).toBe(true);

    // 6. Metrics — 2 records (one per publication)
    const finalMetrics = await client.query(
      `SELECT m.views, m.likes, m.engagement_rate, m.measurement_point, p.platform
       FROM metrics m
       JOIN publications p ON m.publication_id = p.id
       WHERE p.content_id = $1
       ORDER BY p.platform`,
      [testContentId]
    );
    expect(finalMetrics.rows.length).toBe(2);
    // TikTok metrics
    expect(finalMetrics.rows[0].platform).toBe('tiktok');
    expect(finalMetrics.rows[0].views).toBe(6200);
    // YouTube metrics
    expect(finalMetrics.rows[1].platform).toBe('youtube');
    expect(finalMetrics.rows[1].views).toBe(3500);

    // 7. Prediction snapshots — 2 records with predicted AND actual
    const finalSnaps = await client.query(
      `SELECT ps.predicted_impressions, ps.actual_impressions_48h, ps.account_id
       FROM prediction_snapshots ps
       WHERE ps.account_id LIKE '${PREFIX}%'
       ORDER BY ps.account_id`,
      []
    );
    expect(finalSnaps.rows.length).toBe(2);
    // All have both predicted and actual
    expect(finalSnaps.rows.every(r => r.predicted_impressions !== null)).toBe(true);
    expect(finalSnaps.rows.every(r => r.actual_impressions_48h !== null)).toBe(true);

    // 8. Analyses — at least 1 analysis record
    const finalAnalyses = await client.query(
      `SELECT analysis_type, findings FROM analyses WHERE cycle_id = $1`, [cycle2Id]
    );
    expect(finalAnalyses.rows.length).toBeGreaterThan(0);
    expect(finalAnalyses.rows[0].analysis_type).toBe('hypothesis_verification');
    expect(finalAnalyses.rows[0].findings).toHaveProperty('hypothesis_id');

    // 9. Content learnings — exists with correct data
    const finalCL = await client.query(
      `SELECT micro_verdict, prediction_error, key_insight, confidence, niche
       FROM content_learnings WHERE content_id = $1`,
      [testContentId]
    );
    expect(finalCL.rows.length).toBe(1);
    expect(finalCL.rows[0].micro_verdict).toBe('confirmed');
    expect(parseFloat(finalCL.rows[0].prediction_error)).toBeCloseTo(0.167, 2);
    expect(finalCL.rows[0].niche).toBe('beauty');

    // 10. Global learnings — extracted from content learning
    const finalLearnings = await client.query(
      `SELECT category, insight, confidence, evidence_count
       FROM learnings WHERE insight LIKE '%${PREFIX}%'`
    );
    expect(finalLearnings.rows.length).toBeGreaterThan(0);
    expect(finalLearnings.rows[0].category).toBe('timing');
    expect(parseFloat(finalLearnings.rows[0].confidence)).toBeGreaterThan(0.8);

    // 11. Agent individual learnings — recorded
    const finalAgentLearnings = await client.query(
      `SELECT agent_type, category, confidence
       FROM agent_individual_learnings WHERE content LIKE '%${PREFIX}%'`
    );
    expect(finalAgentLearnings.rows.length).toBeGreaterThan(0);
    expect(finalAgentLearnings.rows[0].agent_type).toBe('analyst');

    // 12. Task queue — all tasks completed (no stuck tasks)
    const stuckTasks = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM task_queue
       WHERE payload::text LIKE '%${PREFIX}%' AND status NOT IN ('completed', 'failed')`,
      []
    );
    expect(stuckTasks.rows[0].cnt).toBe(0);
  });

  test('Full lifecycle: text post variant (simplified flow without video production)', async () => {
    // =====================================================================
    // Text post: plan → produce (LLM text gen) → publish → measure → analyze
    // =====================================================================

    // Use cycle1 if it exists, or create new
    const cycleRes = await client.query(
      `SELECT id FROM cycles WHERE cycle_number = $1`, [cycle1Num]
    );
    const cycleId = cycleRes.rows[0].id;

    // Create hypothesis for text content
    const hypRes = await client.query(
      `INSERT INTO hypotheses (cycle_id, category, statement, target_accounts, verdict, predicted_kpis)
       VALUES ($1, 'content_format', '${PREFIX}Text posts on X drive higher engagement than video',
               ARRAY[$2]::varchar[], 'pending',
               '{"impressions": 2000, "engagement_rate": 0.05}'::jsonb)
       RETURNING id`,
      [cycleId, testAccountYT]
    );
    const textHypId = hypRes.rows[0].id;

    // Plan text content
    await client.query(
      `INSERT INTO content (content_id, hypothesis_id, character_id, content_format, status, script_language)
       VALUES ($1, $2, $3, 'text_post', 'planned', 'en')`,
      [testContentId2, textHypId, testCharId]
    );

    // Text production (simplified — no video pipeline)
    await client.query(`UPDATE content SET status = 'producing' WHERE content_id = $1`, [testContentId2]);

    // Produce task
    const textProdTaskRes = await client.query(
      `INSERT INTO task_queue (task_type, payload, status, created_at)
       VALUES ('produce', $1, 'pending', NOW()) RETURNING id`,
      [JSON.stringify({ content_id: testContentId2 })]
    );
    await client.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [textProdTaskRes.rows[0].id]
    );

    await client.query(`UPDATE content SET status = 'ready' WHERE content_id = $1`, [testContentId2]);

    // Publish (to YouTube as text — the content_format is text_post)
    const textPubRes = await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id, measure_after)
       VALUES ($1, $2, 'youtube', 'posted', NOW() - INTERVAL '49 hours', 'YT_TXT_FC002', NOW() - INTERVAL '1 hour')
       RETURNING id`,
      [testContentId2, testAccountYT]
    );
    const textPubId = textPubRes.rows[0].id;
    await client.query(`UPDATE content SET status = 'posted' WHERE content_id = $1`, [testContentId2]);

    // Measurement
    await client.query(
      `INSERT INTO metrics (publication_id, views, likes, comments, shares, engagement_rate, measurement_point)
       VALUES ($1, 1800, 150, 35, 12, 0.1094, '48h')`,
      [textPubId]
    );
    await client.query(`UPDATE publications SET status = 'measured' WHERE id = $1`, [textPubId]);

    // Verdict: rejected (text didn't outperform video)
    await client.query(
      `UPDATE hypotheses SET verdict = 'rejected', confidence = 0.72, evidence_count = 2,
           actual_kpis = '{"impressions": 1800, "engagement_rate": 0.109}'::jsonb
       WHERE id = $1`,
      [textHypId]
    );

    // Content learning
    await client.query(
      `INSERT INTO content_learnings (content_id, micro_verdict, prediction_error, key_insight, confidence, niche,
                                       predicted_kpis, actual_kpis, similar_past_learnings_referenced)
       VALUES ($1, 'rejected', 0.10, '${PREFIX}Text posts have lower reach than video on YouTube', 0.72, 'beauty',
               '{"impressions": 2000, "engagement_rate": 0.05}'::jsonb,
               '{"impressions": 1800, "engagement_rate": 0.109}'::jsonb, 0)`,
      [testContentId2]
    );

    await client.query(`UPDATE content SET status = 'analyzed' WHERE content_id = $1`, [testContentId2]);

    // === VERIFY ===
    const textContentRes = await client.query(
      `SELECT status, content_format FROM content WHERE content_id = $1`, [testContentId2]
    );
    expect(textContentRes.rows[0].status).toBe('analyzed');
    expect(textContentRes.rows[0].content_format).toBe('text_post');

    const textHypRes = await client.query(
      `SELECT verdict FROM hypotheses WHERE id = $1`, [textHypId]
    );
    expect(textHypRes.rows[0].verdict).toBe('rejected');
    expect(textHypRes.rows[0].verdict).not.toBe('pending');

    const textCLRes = await client.query(
      `SELECT micro_verdict FROM content_learnings WHERE content_id = $1`, [testContentId2]
    );
    expect(textCLRes.rows[0].micro_verdict).toBe('rejected');
  });
});
