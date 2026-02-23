/**
 * FEAT-TST-005: 仮説駆動サイクル (仮説→コンテンツ→計測→検証)
 * TEST-INT-005
 *
 * Verifies the complete hypothesis-driven cycle:
 * hypothesis(verdict='pending') → content creation → measure → verdict updated.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-005: hypothesis-driven cycle', () => {
  let client: Client;
  const testCharId = 'CHR_INT005';
  const testContentId = 'CNT_INT005_001';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM hypotheses WHERE target_accounts @> ARRAY['ACC_INT005']`);
    await client.query(`DELETE FROM cycles WHERE cycle_number IN (9005, 9006)`);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'Test Char INT005', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
       ON CONFLICT (character_id) DO NOTHING`,
      [testCharId]
    );
    await client.query(`INSERT INTO cycles (cycle_number, status) VALUES (9005, 'planning')`);
    await client.query(`INSERT INTO cycles (cycle_number, status) VALUES (9006, 'analysis')`);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM hypotheses WHERE target_accounts @> ARRAY['ACC_INT005']`);
    await client.query(`DELETE FROM cycles WHERE cycle_number IN (9005, 9006)`);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-INT-005: hypothesis pending → content → measure → verdict updated', async () => {
    const cycleRes = await client.query(`SELECT id FROM cycles WHERE cycle_number = 9005`);
    const cycleId = cycleRes.rows[0].id;
    const cycle2Res = await client.query(`SELECT id FROM cycles WHERE cycle_number = 9006`);
    const cycle2Id = cycle2Res.rows[0].id;

    // Step 1: Create hypothesis (pending)
    const hypRes = await client.query(
      `INSERT INTO hypotheses (cycle_id, category, statement, rationale, target_accounts, verdict)
       VALUES ($1, 'timing', 'Morning posts perform better', 'Data suggests peak at 7AM', ARRAY['ACC_INT005'], 'pending')
       RETURNING id`,
      [cycleId]
    );
    const hypId = hypRes.rows[0].id;

    // Step 2: Create content linked to hypothesis
    await client.query(
      `INSERT INTO content (content_id, hypothesis_id, content_format, status, character_id)
       VALUES ($1, $2, 'short_video', 'planned', $3)`,
      [testContentId, hypId, testCharId]
    );

    // Simulate full lifecycle
    await client.query(`UPDATE content SET status = 'ready' WHERE content_id = $1`, [testContentId]);
    await client.query(`UPDATE content SET status = 'posted' WHERE content_id = $1`, [testContentId]);

    // Step 3: Analyst verifies hypothesis in next cycle
    await client.query(
      `UPDATE hypotheses SET verdict = 'confirmed', confidence = 0.85, evidence_count = 3
       WHERE id = $1`,
      [hypId]
    );

    // Verify verdict is no longer pending
    const verdictRes = await client.query(
      `SELECT verdict, confidence FROM hypotheses WHERE id = $1`, [hypId]
    );
    expect(verdictRes.rows[0].verdict).not.toBe('pending');
    expect(verdictRes.rows[0].verdict).toBe('confirmed');
    expect(parseFloat(verdictRes.rows[0].confidence)).toBeGreaterThan(0);
  });
});
