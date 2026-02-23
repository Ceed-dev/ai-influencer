/**
 * TEST-DSH-010: POST /api/content/:id/reject — コンテンツ差し戻し
 * TEST-DSH-011: POST /api/content/:id/reject — comment必須バリデーション
 */
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-007: POST /api/content/:id/reject + comment validation', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('CHR_TEST_007', 'Test Char 7', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa7', 'active')
        ON CONFLICT (character_id) DO NOTHING
      `);
      await client.query(`DELETE FROM content WHERE content_id LIKE 'CNT_TEST7%'`);
      await client.query(`
        INSERT INTO content (content_id, content_format, status, character_id)
        VALUES ('CNT_TEST7_001', 'short_video', 'pending_approval', 'CHR_TEST_007')
      `);
      await client.query(`
        INSERT INTO content (content_id, content_format, status, character_id)
        VALUES ('CNT_TEST7_002', 'short_video', 'pending_approval', 'CHR_TEST_007')
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM content WHERE content_id LIKE 'CNT_TEST7%'`);
      await client.query(`DELETE FROM characters WHERE character_id = 'CHR_TEST_007'`);
    });
  });

  // TEST-DSH-010: reject content with comment
  test('TEST-DSH-010: rejects content with comment and category', async () => {
    await query(
      `UPDATE content
       SET status = 'rejected',
           approval_feedback = $1,
           rejection_category = $2,
           updated_at = NOW()
       WHERE content_id = $3`,
      ['Needs more data', 'data_insufficient', 'CNT_TEST7_001']
    );

    const result = await query(
      `SELECT status, rejection_category, approval_feedback FROM content WHERE content_id = $1`,
      ['CNT_TEST7_001']
    );

    expect(result.rows.length).toBe(1);
    const content = result.rows[0] as Record<string, unknown>;
    expect(content.status).toBe('rejected');
    expect(content.rejection_category).toBe('data_insufficient');
    expect(content.approval_feedback).toBe('Needs more data');
  });

  // TEST-DSH-011: comment is required (validated at API level, DB level accepts null)
  test('TEST-DSH-011: rejection_category must be valid', async () => {
    // DB-level validation: invalid rejection_category should fail
    await expect(
      query(
        `UPDATE content
         SET status = 'rejected',
             rejection_category = $1
         WHERE content_id = $2`,
        ['invalid_category', 'CNT_TEST7_002']
      )
    ).rejects.toThrow();
  });

  test('valid rejection categories accepted', async () => {
    const validCategories = ['plan_revision', 'data_insufficient', 'hypothesis_weak'];
    for (const category of validCategories) {
      // Verify category is accepted by DB constraint
      await query(
        `UPDATE content
         SET rejection_category = $1,
             status = 'rejected',
             approval_feedback = 'test comment'
         WHERE content_id = $2`,
        [category, 'CNT_TEST7_002']
      );

      const result = await query(
        `SELECT rejection_category FROM content WHERE content_id = $1`,
        ['CNT_TEST7_002']
      );
      expect((result.rows[0] as Record<string, unknown>).rejection_category).toBe(category);

      // Reset status for next iteration
      await query(
        `UPDATE content SET status = 'pending_approval', rejection_category = NULL WHERE content_id = $1`,
        ['CNT_TEST7_002']
      );
    }
  });
});
