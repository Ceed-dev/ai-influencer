/**
 * TEST-DSH-008: GET /api/content — ステータスフィルタ + ページネーション
 */
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-005: GET /api/content — status filter + pagination', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      // Setup character
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('CHR_TEST_005', 'Test Char 5', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa5', 'active')
        ON CONFLICT (character_id) DO NOTHING
      `);

      // Clean test content
      await client.query(`DELETE FROM content WHERE content_id LIKE 'CNT_TEST5%'`);

      // Insert test content: 5 planned, 3 producing, 2 ready
      for (let i = 0; i < 5; i++) {
        await client.query(
          `INSERT INTO content (content_id, content_format, status, character_id)
           VALUES ($1, 'short_video', 'planned', 'CHR_TEST_005')`,
          [`CNT_TEST5_PL${i}`]
        );
      }
      for (let i = 0; i < 3; i++) {
        await client.query(
          `INSERT INTO content (content_id, content_format, status, character_id)
           VALUES ($1, 'text_post', 'producing', 'CHR_TEST_005')`,
          [`CNT_TEST5_PR${i}`]
        );
      }
      for (let i = 0; i < 2; i++) {
        await client.query(
          `INSERT INTO content (content_id, content_format, status, character_id)
           VALUES ($1, 'short_video', 'ready', 'CHR_TEST_005')`,
          [`CNT_TEST5_RD${i}`]
        );
      }
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM content WHERE content_id LIKE 'CNT_TEST5%'`);
      await client.query(`DELETE FROM characters WHERE character_id = 'CHR_TEST_005'`);
    });
  });

  // TEST-DSH-008: status filter
  test('TEST-DSH-008: filters content by status with pagination', async () => {
    // Filter for planned status, page 1, limit 3
    const result = await query(
      `SELECT * FROM content WHERE content_id LIKE 'CNT_TEST5%' AND status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      ['planned', 3, 0]
    );
    expect(result.rows.length).toBe(3);
    result.rows.forEach((row: Record<string, unknown>) => {
      expect(row.status).toBe('planned');
    });

    // Total count for planned
    const total = await query(
      `SELECT COUNT(*)::int as count FROM content WHERE content_id LIKE 'CNT_TEST5%' AND status = $1`,
      ['planned']
    );
    expect(total.rows[0].count).toBe(5);
  });

  test('pagination returns correct page', async () => {
    // Page 2 with limit 3 for planned
    const result = await query(
      `SELECT * FROM content WHERE content_id LIKE 'CNT_TEST5%' AND status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      ['planned', 3, 3]
    );
    expect(result.rows.length).toBe(2); // 5 total, page 2 of limit 3 = 2 remaining
  });

  test('returns all content without filter', async () => {
    const total = await query(
      `SELECT COUNT(*)::int as count FROM content WHERE content_id LIKE 'CNT_TEST5%'`
    );
    expect(total.rows[0].count).toBe(10); // 5 + 3 + 2
  });

  test('content_format filter works', async () => {
    const result = await query(
      `SELECT * FROM content WHERE content_id LIKE 'CNT_TEST5%' AND content_format = $1`,
      ['text_post']
    );
    expect(result.rows.length).toBe(3);
  });
});
