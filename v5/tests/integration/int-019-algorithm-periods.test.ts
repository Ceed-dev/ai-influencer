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

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM algorithm_performance WHERE metric_name LIKE 'INT019%'`);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM algorithm_performance WHERE metric_name LIKE 'INT019%'`);
    await client.end();
  });

  test('TEST-INT-019: daily, weekly, monthly period records exist', async () => {
    const periods = ['daily', 'weekly', 'monthly'];

    for (const period of periods) {
      await client.query(
        `INSERT INTO algorithm_performance (period, metric_name, metric_value, measured_at)
         VALUES ($1, $2, $3, NOW())`,
        [period, `INT019_${period}_accuracy`, JSON.stringify({ value: 0.85 })]
      );
    }

    const res = await client.query(
      `SELECT period, COUNT(*)::int AS cnt
       FROM algorithm_performance
       WHERE metric_name LIKE 'INT019%'
       GROUP BY period`
    );

    expect(res.rows).toHaveLength(3);
    const periodSet = new Set(res.rows.map((r: any) => r.period));
    expect(periodSet.has('daily')).toBe(true);
    expect(periodSet.has('weekly')).toBe(true);
    expect(periodSet.has('monthly')).toBe(true);
  });
});
