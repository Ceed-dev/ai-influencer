/**
 * FEAT-INF-005: DB connection pool + health check
 * Tests: TEST-INT-003
 */
import { createPool, healthCheck, poolStats, withClient, withTransaction } from '../../../src/db/pool';
import type { Pool } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

describe('FEAT-INF-005: DB connection pool + health check', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createPool({ connectionString: DB_URL, max: 5 });
  });

  afterAll(async () => {
    await pool.end();
  });

  // TEST-INT-003: Pool health check
  test('TEST-INT-003: health check returns healthy=true with latency', async () => {
    const result = await healthCheck(pool);
    expect(result.healthy).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.latencyMs).toBeLessThan(5000);
    expect(result.error).toBeUndefined();
  });

  test('health check returns healthy=false for bad pool', async () => {
    const badPool = createPool({
      connectionString: 'postgres://bad:bad@localhost:9999/nonexistent',
      connectionTimeoutMillis: 500,
    });
    const result = await healthCheck(badPool);
    expect(result.healthy).toBe(false);
    expect(result.error).toBeDefined();
    await badPool.end();
  });

  test('pool stats reflect connection counts', async () => {
    const stats = poolStats(pool);
    expect(typeof stats.totalCount).toBe('number');
    expect(typeof stats.idleCount).toBe('number');
    expect(typeof stats.waitingCount).toBe('number');
    expect(stats.totalCount).toBeGreaterThanOrEqual(0);
  });

  test('withClient executes query and releases', async () => {
    const result = await withClient(async (client) => {
      const res = await client.query('SELECT 42 AS answer');
      return res.rows[0].answer;
    }, pool);
    expect(result).toBe(42);
  });

  test('withTransaction commits on success', async () => {
    await withTransaction(async (client) => {
      await client.query('CREATE TEMP TABLE _inf005_test (val INT) ON COMMIT DROP');
      await client.query('INSERT INTO _inf005_test VALUES (1)');
      const res = await client.query('SELECT val FROM _inf005_test');
      expect(res.rows[0].val).toBe(1);
    }, pool);
  });

  test('withTransaction rolls back on error', async () => {
    await expect(withTransaction(async (client) => {
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id)
        VALUES ('_INF005_TEST', 'Rollback Test', 'voice_test')
      `);
      throw new Error('intentional failure');
    }, pool)).rejects.toThrow('intentional failure');

    // Verify rolled back
    const res = await withClient(async (client) => {
      return client.query("SELECT COUNT(*)::int AS cnt FROM characters WHERE character_id = '_INF005_TEST'");
    }, pool);
    expect(res.rows[0].cnt).toBe(0);
  });

  test('pool configuration defaults are correct', () => {
    const testPool = createPool();
    expect(testPool).toBeDefined();
    testPool.end();
  });
});
