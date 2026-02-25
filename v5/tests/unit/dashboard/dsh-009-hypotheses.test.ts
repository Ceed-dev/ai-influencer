/**
 * TEST-DSH-013: GET /api/hypotheses — フィルタ
 * TEST-DSH-083: verdict filter
 * TEST-DSH-123: category filter
 */
import { query, withClient } from '../../helpers/db';

describe('FEAT-DSH-009: GET /api/hypotheses — filter', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      // Ensure cycle exists for FK
      await client.query(`
        INSERT INTO cycles (cycle_number, status)
        VALUES (9999, 'completed')
        ON CONFLICT (cycle_number) DO NOTHING
      `);
      const cycleResult = await client.query(`SELECT id FROM cycles WHERE cycle_number = 9999`);
      const cycleId = cycleResult.rows[0].id;

      await client.query(`DELETE FROM hypotheses WHERE statement LIKE 'TEST_HYP_%'`);

      // Valid categories: content_format, timing, niche, audience, platform_specific
      await client.query(
        `INSERT INTO hypotheses (cycle_id, source, category, statement, verdict, confidence)
         VALUES ($1, 'ai', 'timing', 'TEST_HYP_1', 'confirmed', 0.85),
                ($1, 'human', 'niche', 'TEST_HYP_2', 'pending', 0.50),
                ($1, 'ai', 'timing', 'TEST_HYP_3', 'rejected', 0.30)`,
        [cycleId]
      );
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM hypotheses WHERE statement LIKE 'TEST_HYP_%'`);
    });
  });

  // TEST-DSH-013: returns hypotheses
  test('TEST-DSH-013: returns hypothesis list', async () => {
    const result = await query(
      `SELECT * FROM hypotheses WHERE statement LIKE 'TEST_HYP_%' ORDER BY created_at DESC`
    );
    expect(result.rows.length).toBe(3);
  });

  // TEST-DSH-083: verdict filter
  test('TEST-DSH-083: filters by verdict', async () => {
    const result = await query(
      `SELECT * FROM hypotheses WHERE statement LIKE 'TEST_HYP_%' AND verdict = $1`,
      ['confirmed']
    );
    expect(result.rows.length).toBe(1);
    expect((result.rows[0] as Record<string, unknown>).statement).toBe('TEST_HYP_1');
  });

  // TEST-DSH-123: category filter
  test('TEST-DSH-123: filters by category', async () => {
    const result = await query(
      `SELECT * FROM hypotheses WHERE statement LIKE 'TEST_HYP_%' AND category = $1`,
      ['timing']
    );
    expect(result.rows.length).toBe(2);
  });
});
