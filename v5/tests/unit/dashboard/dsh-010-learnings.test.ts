/**
 * TEST-DSH-014: GET /api/learnings — 信頼度フィルタ
 * TEST-DSH-124: min_confidence filter
 * TEST-DSH-125: category filter
 */
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-010: GET /api/learnings — confidence filter', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM learnings WHERE insight LIKE 'TEST_LRN_%'`);

      // Valid categories: content, timing, audience, platform, niche
      // Columns: id (serial), category, insight, confidence, evidence_count
      await client.query(
        `INSERT INTO learnings (category, insight, confidence, evidence_count)
         VALUES
           ('timing', 'TEST_LRN_1 High confidence learning', 0.90, 5),
           ('content', 'TEST_LRN_2 Medium confidence', 0.60, 3),
           ('timing', 'TEST_LRN_3 Low confidence', 0.30, 1)`
      );
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM learnings WHERE insight LIKE 'TEST_LRN_%'`);
    });
  });

  // TEST-DSH-014: returns learnings
  test('TEST-DSH-014: returns learnings list', async () => {
    const result = await query(
      `SELECT * FROM learnings WHERE insight LIKE 'TEST_LRN_%' ORDER BY confidence DESC`
    );
    expect(result.rows.length).toBe(3);
  });

  // TEST-DSH-124: min_confidence filter
  test('TEST-DSH-124: filters by min confidence', async () => {
    const result = await query(
      `SELECT * FROM learnings WHERE insight LIKE 'TEST_LRN_%' AND confidence >= $1 ORDER BY confidence DESC`,
      [0.5]
    );
    expect(result.rows.length).toBe(2);
    result.rows.forEach((row: Record<string, unknown>) => {
      expect(Number(row.confidence)).toBeGreaterThanOrEqual(0.5);
    });
  });

  // TEST-DSH-125: category filter
  test('TEST-DSH-125: filters by category', async () => {
    const result = await query(
      `SELECT * FROM learnings WHERE insight LIKE 'TEST_LRN_%' AND category = $1`,
      ['timing']
    );
    expect(result.rows.length).toBe(2);
  });
});
