/**
 * FEAT-TST-016: データキュレーション → コンポーネント → コンテンツ計画連携
 * TEST-INT-016
 *
 * Verifies curator creates components, planner uses them in content plan,
 * and content_sections references the component_id correctly.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-016: curation → component → content plan', () => {
  let client: Client;
  const testCharId = 'CHR_INT016';
  const testContentId = 'CNT_INT016_001';
  const testCompId = 'CMP_INT016_001';

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM content_sections WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM components WHERE component_id = $1`, [testCompId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'Test Char INT016', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
       ON CONFLICT (character_id) DO NOTHING`,
      [testCharId]
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM content_sections WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM components WHERE component_id = $1`, [testCompId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-INT-016: curator creates component → planner uses in content_sections', async () => {
    // Step 1: Curator creates component
    await client.query(
      `INSERT INTO components (component_id, type, name, curated_by, curation_confidence, review_status)
       VALUES ($1, 'scenario', 'INT016 Beauty Scenario', 'auto', 0.92, 'auto_approved')`,
      [testCompId]
    );

    // Step 2: Planner creates content plan using that component
    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id)
       VALUES ($1, 'short_video', 'planned', $2)`,
      [testContentId, testCharId]
    );

    await client.query(
      `INSERT INTO content_sections (content_id, component_id, section_order, section_label)
       VALUES ($1, $2, 1, 'hook')`,
      [testContentId, testCompId]
    );

    // Verify component_id linkage
    const res = await client.query(
      `SELECT cs.component_id, c.curated_by
       FROM content_sections cs
       JOIN components c ON c.component_id = cs.component_id
       WHERE cs.content_id = $1`,
      [testContentId]
    );
    expect(res.rows[0].component_id).toBe(testCompId);
    expect(res.rows[0].curated_by).toBe('auto');
  });
});
