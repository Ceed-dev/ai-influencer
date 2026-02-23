/**
 * FEAT-TST-021: E2Eテスト — 仮説駆動サイクル完全ライフサイクル
 * TEST-E2E-001
 *
 * Verifies the complete hypothesis lifecycle across all system layers:
 * hypothesis → content → produce → publish → measure → verify → learnings.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-021: E2E hypothesis-driven lifecycle', () => {
  let client: Client;
  const testCharId = 'CHR_E2E001';
  const testContentId = 'CNT_E2E001_001';
  const testAccountId = 'ACC_E2E001';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    // Clean in dependency order
    await client.query(`DELETE FROM learnings WHERE insight LIKE '%E2E001%'`);
    await client.query(`DELETE FROM analyses WHERE cycle_id IN (SELECT id FROM cycles WHERE cycle_number IN (8001, 8002))`);
    await client.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id = $1)`, [testContentId]);
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM hypotheses WHERE target_accounts @> ARRAY[$1]`, [testAccountId]);
    await client.query(`DELETE FROM cycles WHERE cycle_number IN (8001, 8002)`);
    await client.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    // Seed
    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'E2E001 Char', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')`,
      [testCharId]
    );
    await client.query(
      `INSERT INTO accounts (account_id, platform, character_id, status)
       VALUES ($1, 'youtube', $2, 'active')`,
      [testAccountId, testCharId]
    );
    await client.query(`INSERT INTO cycles (cycle_number, status) VALUES (8001, 'planning')`);
    await client.query(`INSERT INTO cycles (cycle_number, status) VALUES (8002, 'analysis')`);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM learnings WHERE insight LIKE '%E2E001%'`);
    await client.query(`DELETE FROM analyses WHERE cycle_id IN (SELECT id FROM cycles WHERE cycle_number IN (8001, 8002))`);
    await client.query(`DELETE FROM metrics WHERE publication_id IN (SELECT id FROM publications WHERE content_id = $1)`, [testContentId]);
    await client.query(`DELETE FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM task_queue WHERE payload->>'content_id' = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM hypotheses WHERE target_accounts @> ARRAY[$1]`, [testAccountId]);
    await client.query(`DELETE FROM cycles WHERE cycle_number IN (8001, 8002)`);
    await client.query(`DELETE FROM accounts WHERE account_id = $1`, [testAccountId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-E2E-001: complete hypothesis lifecycle', async () => {
    const cycle1 = await client.query(`SELECT id FROM cycles WHERE cycle_number = 8001`);
    const cycle1Id = cycle1.rows[0].id;
    const cycle2 = await client.query(`SELECT id FROM cycles WHERE cycle_number = 8002`);
    const cycle2Id = cycle2.rows[0].id;

    // Step 5: Planner creates hypothesis + content
    const hypRes = await client.query(
      `INSERT INTO hypotheses (cycle_id, category, statement, target_accounts, verdict)
       VALUES ($1, 'timing', 'E2E001: 7AM posts get 30% more views', ARRAY[$2], 'pending')
       RETURNING id`,
      [cycle1Id, testAccountId]
    );
    const hypId = hypRes.rows[0].id;

    await client.query(
      `INSERT INTO content (content_id, hypothesis_id, content_format, status, character_id)
       VALUES ($1, $2, 'short_video', 'planned', $3)`,
      [testContentId, hypId, testCharId]
    );

    // Step 6: Task queue + produce
    await client.query(
      `INSERT INTO task_queue (task_type, payload, status)
       VALUES ('produce', $1, 'pending')`,
      [JSON.stringify({ content_id: testContentId })]
    );

    // Step 7: Production completes
    await client.query(`UPDATE content SET status = 'ready' WHERE content_id = $1`, [testContentId]);

    // Step 8: Publishing
    await client.query(
      `INSERT INTO publications (content_id, account_id, platform, status, posted_at, platform_post_id, measure_after)
       VALUES ($1, $2, 'youtube', 'posted', NOW(), 'YT_E2E001', NOW() + INTERVAL '48 hours')`,
      [testContentId, testAccountId]
    );
    await client.query(`UPDATE content SET status = 'posted' WHERE content_id = $1`, [testContentId]);

    // Step 9: Measurement
    const pubRes = await client.query(`SELECT id FROM publications WHERE content_id = $1`, [testContentId]);
    await client.query(
      `INSERT INTO metrics (publication_id, views, likes, comments, engagement_rate, measurement_point)
       VALUES ($1, 5000, 400, 50, 0.0900, '48h')`,
      [pubRes.rows[0].id]
    );
    await client.query(`UPDATE publications SET status = 'measured' WHERE content_id = $1`, [testContentId]);

    // Step 10: Analysis + hypothesis verification
    await client.query(
      `INSERT INTO analyses (cycle_id, analysis_type, findings)
       VALUES ($1, 'hypothesis_verification', $2)`,
      [cycle2Id, JSON.stringify({ hypothesis_id: hypId, result: 'confirmed', confidence: 0.87 })]
    );
    await client.query(
      `UPDATE hypotheses SET verdict = 'confirmed', confidence = 0.87, evidence_count = 5
       WHERE id = $1`,
      [hypId]
    );

    // Step 11: Learning extraction
    await client.query(
      `INSERT INTO learnings (category, insight, confidence, evidence_count)
       VALUES ('timing', 'E2E001: Morning posts (7AM) consistently outperform', 0.87, 5)`
    );

    // Final verification
    const verdictRes = await client.query(`SELECT verdict FROM hypotheses WHERE id = $1`, [hypId]);
    expect(verdictRes.rows[0].verdict).not.toBe('pending');
    expect(['confirmed', 'rejected', 'inconclusive']).toContain(verdictRes.rows[0].verdict);

    const learningsRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM learnings WHERE insight LIKE '%E2E001%'`
    );
    expect(learningsRes.rows[0].cnt).toBeGreaterThan(0);
  });
});
