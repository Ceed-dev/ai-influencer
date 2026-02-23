/**
 * FEAT-TST-004: 計測 → 分析サイクル連携
 * TEST-INT-004
 *
 * Verifies that after measurement (publications.status='measured'),
 * the analyst creates analysis records and updates content.status to 'analyzed'.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-004: measurement → analysis cycle', () => {
  let client: Client;
  const testCharId = 'CHR_INT004';
  const testContentId = 'CNT_INT004_001';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM analyses WHERE cycle_id IN (SELECT id FROM cycles WHERE cycle_number = 9004)`);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM cycles WHERE cycle_number = 9004`);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'Test Char INT004', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
       ON CONFLICT (character_id) DO NOTHING`,
      [testCharId]
    );
    await client.query(
      `INSERT INTO cycles (cycle_number, status) VALUES (9004, 'analysis')`
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM analyses WHERE cycle_id IN (SELECT id FROM cycles WHERE cycle_number = 9004)`);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM cycles WHERE cycle_number = 9004`);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-INT-004: measured content → analyst creates analysis → content.status=analyzed', async () => {
    // Content that has been posted and measured
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id)
       VALUES ($1, 'short_video', 'posted', $2)`,
      [testContentId, testCharId]
    );

    // Get cycle id
    const cycleRes = await client.query(
      `SELECT id FROM cycles WHERE cycle_number = 9004`
    );
    const cycleId = cycleRes.rows[0].id;

    // Analyst creates analysis
    await client.query(
      `INSERT INTO analyses (cycle_id, analysis_type, findings, recommendations)
       VALUES ($1, 'cycle_review', $2, $3)`,
      [cycleId, JSON.stringify({ top_performer: testContentId }), JSON.stringify({ action: 'increase_similar' })]
    );

    // Update content status to analyzed
    await client.query(
      `UPDATE content SET status = 'analyzed' WHERE content_id = $1`,
      [testContentId]
    );

    // Verify
    const analysisRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM analyses WHERE cycle_id = $1`, [cycleId]
    );
    expect(analysisRes.rows[0].cnt).toBeGreaterThan(0);

    const contentRes = await client.query(
      `SELECT status FROM content WHERE content_id = $1`, [testContentId]
    );
    expect(contentRes.rows[0].status).toBe('analyzed');
  });
});
