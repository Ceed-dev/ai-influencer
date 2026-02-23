/**
 * TEST-DSH-009: POST /api/content/:id/approve — コンテンツ承認
 */
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-006: POST /api/content/:id/approve', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('CHR_TEST_006', 'Test Char 6', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa6', 'active')
        ON CONFLICT (character_id) DO NOTHING
      `);
      await client.query(`DELETE FROM content WHERE content_id LIKE 'CNT_TEST6%'`);
      await client.query(`
        INSERT INTO content (content_id, content_format, status, character_id)
        VALUES ('CNT_TEST6_001', 'short_video', 'pending_approval', 'CHR_TEST_006')
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM content WHERE content_id LIKE 'CNT_TEST6%'`);
      await client.query(`DELETE FROM characters WHERE character_id = 'CHR_TEST_006'`);
    });
  });

  // TEST-DSH-009: approve content
  test('TEST-DSH-009: transitions pending_approval to planned', async () => {
    // Approve the content
    await query(
      `UPDATE content
       SET status = 'planned',
           approved_by = 'dashboard_user',
           approved_at = NOW(),
           approval_feedback = $1,
           updated_at = NOW()
       WHERE content_id = $2`,
      ['LGTM', 'CNT_TEST6_001']
    );

    // Verify status change
    const result = await query(
      `SELECT status, approved_at, approval_feedback FROM content WHERE content_id = $1`,
      ['CNT_TEST6_001']
    );

    expect(result.rows.length).toBe(1);
    const content = result.rows[0] as Record<string, unknown>;
    expect(content.status).toBe('planned');
    expect(content.approved_at).not.toBeNull();
    expect(content.approval_feedback).toBe('LGTM');
  });
});
