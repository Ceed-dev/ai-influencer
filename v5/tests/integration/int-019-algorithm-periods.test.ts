/**
 * FEAT-TST-019: algorithm_performance 日次・週次・月次記録
 * TEST-INT-019
 *
 * Verifies that algorithm_performance records daily, weekly, and monthly periods.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-019: algorithm_performance periods', () => {
  let client: Client;
  // Use a distinct metadata tag to identify test records for cleanup
  const testTag = { test_id: 'INT019' };

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM algorithm_performance WHERE metadata @> $1`, [JSON.stringify(testTag)]);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM algorithm_performance WHERE metadata @> $1`, [JSON.stringify(testTag)]);
    await client.end();
  });

  test('TEST-INT-019: daily, weekly, monthly period records exist', async () => {
    const periods = ['daily', 'weekly', 'monthly'];

    for (const period of periods) {
      await client.query(
        `INSERT INTO algorithm_performance (period, hypothesis_accuracy, prediction_error, learning_count, measured_at, metadata)
         VALUES ($1, 0.8500, 0.1200, 5, NOW(), $2)`,
        [period, JSON.stringify({ ...testTag, period_label: `INT019_${period}_accuracy` })]
      );
    }

    const res = await client.query(
      `SELECT period, COUNT(*)::int AS cnt
       FROM algorithm_performance
       WHERE metadata @> $1
       GROUP BY period`,
      [JSON.stringify(testTag)]
    );

    expect(res.rows).toHaveLength(3);
    const periodSet = new Set(res.rows.map((r: any) => r.period));
    expect(periodSet.has('daily')).toBe(true);
    expect(periodSet.has('weekly')).toBe(true);
    expect(periodSet.has('monthly')).toBe(true);
  });
});
