/**
 * FEAT-TST-007: MCP Server → PostgreSQL トランザクション整合性
 * TEST-INT-007
 *
 * Verifies that plan_content-style operations (content + sections) are atomic.
 * If section creation fails mid-way, the entire transaction must roll back
 * leaving no partial data in content or content_sections.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

function createClient(): Client {
  return new Client({ connectionString: TEST_DB_URL });
}

describe('FEAT-TST-007: MCP→PostgreSQL transaction integrity', () => {
  let client: Client;
  const testContentId = 'CNT_INT007_001';
  const testCharId = 'CHR_INT007';
  const testCompIds = ['CMP_INT007_A', 'CMP_INT007_B', 'CMP_INT007_C'];

  beforeAll(async () => {
    client = createClient();
    await client.connect();

    // Clean up any leftovers
    await client.query(`DELETE FROM content_sections WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM components WHERE component_id = ANY($1)`, [testCompIds]);
    await client.query(`DELETE FROM accounts WHERE character_id = $1`, [testCharId]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);

    // Seed character and components for valid sections
    await client.query(
      `INSERT INTO characters (character_id, name, voice_id, status)
       VALUES ($1, 'Test Char INT007', 'aaaa1111bbbb2222cccc3333dddd4444', 'active')
       ON CONFLICT (character_id) DO NOTHING`,
      [testCharId]
    );
    for (const compId of testCompIds) {
      await client.query(
        `INSERT INTO components (component_id, type, name, curated_by, review_status)
         VALUES ($1, 'scenario', $2, 'human', 'auto_approved')
         ON CONFLICT (component_id) DO NOTHING`,
        [compId, `Component ${compId}`]
      );
    }
  });

  afterAll(async () => {
    // Cleanup
    await client.query(`DELETE FROM content_sections WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM content WHERE content_id = $1`, [testContentId]);
    await client.query(`DELETE FROM components WHERE component_id = ANY($1)`, [testCompIds]);
    await client.query(`DELETE FROM characters WHERE character_id = $1`, [testCharId]);
    await client.end();
  });

  test('TEST-INT-007: atomic content+sections — rollback on section error leaves no partial data', async () => {
    const invalidComponentId = 'CMP_DOES_NOT_EXIST_999';

    // Attempt to create content + 3 sections atomically, where 3rd section has invalid component_id
    let transactionError: Error | null = null;
    try {
      await client.query('BEGIN');

      // Step 1: Insert content row
      await client.query(
        `INSERT INTO content (content_id, content_format, status, character_id)
         VALUES ($1, 'short_video', 'planned', $2)`,
        [testContentId, testCharId]
      );

      // Step 2: Insert section 1 (valid)
      await client.query(
        `INSERT INTO content_sections (content_id, component_id, section_order, section_label)
         VALUES ($1, $2, 1, 'hook')`,
        [testContentId, testCompIds[0]]
      );

      // Step 3: Insert section 2 (valid)
      await client.query(
        `INSERT INTO content_sections (content_id, component_id, section_order, section_label)
         VALUES ($1, $2, 2, 'body')`,
        [testContentId, testCompIds[1]]
      );

      // Step 4: Insert section 3 with INVALID component_id — should trigger FK violation
      await client.query(
        `INSERT INTO content_sections (content_id, component_id, section_order, section_label)
         VALUES ($1, $2, 3, 'cta')`,
        [testContentId, invalidComponentId]
      );

      await client.query('COMMIT');
    } catch (err) {
      transactionError = err as Error;
      await client.query('ROLLBACK');
    }

    // Verify error occurred (FK violation on component_id)
    expect(transactionError).not.toBeNull();
    expect(transactionError!.message).toMatch(/violates foreign key constraint/i);

    // Verify NO partial data remains — content row must not exist
    const contentResult = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM content WHERE content_id = $1`,
      [testContentId]
    );
    expect(contentResult.rows[0].cnt).toBe(0);

    // Verify NO partial data remains — content_sections must not exist
    const sectionsResult = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM content_sections WHERE content_id = $1`,
      [testContentId]
    );
    expect(sectionsResult.rows[0].cnt).toBe(0);
  });

  test('TEST-INT-007: successful transaction commits all content + sections atomically', async () => {
    // Verify that a valid transaction commits everything
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO content (content_id, content_format, status, character_id)
       VALUES ($1, 'short_video', 'planned', $2)`,
      [testContentId, testCharId]
    );

    for (let i = 0; i < 3; i++) {
      await client.query(
        `INSERT INTO content_sections (content_id, component_id, section_order, section_label)
         VALUES ($1, $2, $3, $4)`,
        [testContentId, testCompIds[i], i + 1, ['hook', 'body', 'cta'][i]]
      );
    }

    await client.query('COMMIT');

    // Verify content exists
    const contentResult = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM content WHERE content_id = $1`,
      [testContentId]
    );
    expect(contentResult.rows[0].cnt).toBe(1);

    // Verify all 3 sections exist
    const sectionsResult = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM content_sections WHERE content_id = $1`,
      [testContentId]
    );
    expect(sectionsResult.rows[0].cnt).toBe(3);
  });
});
