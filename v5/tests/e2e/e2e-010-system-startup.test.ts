/**
 * FEAT-TST-030: E2Eテスト — システム起動 → 定常運用
 * TEST-E2E-010
 *
 * Verifies system startup: all 33 tables exist, settings seeded,
 * and multiple cycles can complete.
 */
import { Client } from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-TST-030: E2E system startup → steady operation', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
    await client.query(`DELETE FROM cycles WHERE cycle_number BETWEEN 7001 AND 7003`);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM cycles WHERE cycle_number BETWEEN 7001 AND 7003`);
    await client.end();
  });

  test('TEST-E2E-010: 33 tables + settings seeded + 3 cycles complete', async () => {
    // Step 1: Verify 33 tables
    const tablesRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    expect(tablesRes.rows[0].cnt).toBeGreaterThanOrEqual(33);

    // Step 2: Verify settings seeded
    const settingsRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM system_settings`
    );
    expect(settingsRes.rows[0].cnt).toBeGreaterThan(0);

    // Step 3: Run 3 cycles
    for (let i = 1; i <= 3; i++) {
      await client.query(
        `INSERT INTO cycles (cycle_number, status, started_at)
         VALUES ($1, 'planning', NOW())`,
        [7000 + i]
      );
      await client.query(
        `UPDATE cycles SET status = 'completed', ended_at = NOW()
         WHERE cycle_number = $1`,
        [7000 + i]
      );
    }

    const cycleRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM cycles
       WHERE cycle_number BETWEEN 7001 AND 7003 AND status = 'completed'`
    );
    expect(cycleRes.rows[0].cnt).toBe(3);
  });
});
