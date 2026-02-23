/**
 * FEAT-DB-041: system_settings initial data (124 rows)
 * FEAT-DB-042: system_settings key default values
 * Tests: TEST-DB-046, TEST-DB-047, TEST-DB-048
 */
import { withClient } from '../../helpers/db';

describe('FEAT-DB-041: system_settings seed data', () => {
  // TEST-DB-046: total count = 124
  test('TEST-DB-046: system_settings has 124 rows', async () => {
    await withClient(async (c) => {
      const res = await c.query("SELECT COUNT(*) as cnt FROM system_settings");
      expect(parseInt(res.rows[0].cnt)).toBe(124);
    });
  });

  // TEST-DB-047: category breakdown
  test('TEST-DB-047: category counts match spec', async () => {
    const expected: Record<string, number> = {
      agent: 79,
      cost_control: 4,
      credentials: 5,
      dashboard: 3,
      measurement: 6,
      posting: 8,
      production: 14,
      review: 5,
    };
    await withClient(async (c) => {
      const res = await c.query("SELECT category, COUNT(*)::int as cnt FROM system_settings GROUP BY category ORDER BY category");
      for (const row of res.rows) {
        expect(expected[row.category as string]).toBe(row.cnt);
      }
      expect(res.rows).toHaveLength(8);
    });
  });
});

describe('FEAT-DB-042: system_settings default values', () => {
  // TEST-DB-048
  test('TEST-DB-048: key default values match spec', async () => {
    // JSONB stores numbers as numbers, so '8.0' becomes 8, '0.7' becomes 0.7
    const expectedValues: Record<string, number | boolean | string> = {
      MAX_CONCURRENT_PRODUCTIONS: 5,
      MAX_RETRY_ATTEMPTS: 3,
      HUMAN_REVIEW_ENABLED: true,
      AUTO_APPROVE_SCORE_THRESHOLD: 8.0,
      LEARNING_CONFIDENCE_THRESHOLD: 0.7,
      DAILY_BUDGET_LIMIT_USD: 100,
      EMBEDDING_DIMENSION: 1536,
      LEARNING_SUCCESS_INCREMENT: 0.1,
      LEARNING_FAILURE_DECREMENT: 0.15,
    };
    await withClient(async (c) => {
      const keys = Object.keys(expectedValues);
      const res = await c.query(
        `SELECT setting_key, setting_value FROM system_settings WHERE setting_key = ANY($1)`,
        [keys]
      );
      expect(res.rows).toHaveLength(keys.length);
      for (const row of res.rows) {
        const key = row.setting_key as string;
        const expected = expectedValues[key];
        if (typeof expected === 'number') {
          expect(Number(row.setting_value)).toBeCloseTo(expected as number, 5);
        } else {
          expect(row.setting_value).toBe(expected);
        }
      }
    });
  });
});
