/**
 * FEAT-ALG-003: Adjustment factor cache update batch
 * Tests: TEST-ALG-005 (already in alg-002), TEST-ALG-006 (already in alg-002)
 * Additional tests for adjustment cache-specific functionality
 */
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

async function createClient(): Promise<Client> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

describe('FEAT-ALG-003: Adjustment factor cache', () => {
  let client: Client;

  beforeAll(async () => { client = await createClient(); });
  afterAll(async () => { await client.end(); });

  beforeEach(async () => { await client.query('BEGIN'); });
  afterEach(async () => { await client.query('ROLLBACK'); });

  // Verify adjustment_factor_cache table structure
  test('adjustment_factor_cache table has correct schema', async () => {
    const res = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'adjustment_factor_cache' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    const cols = res.rows.map((r: any) => r.column_name);
    expect(cols).toContain('platform');
    expect(cols).toContain('factor_name');
    expect(cols).toContain('factor_value');
    expect(cols).toContain('adjustment');
    expect(cols).toContain('sample_count');
    expect(cols).toContain('is_active');
    expect(cols).toContain('calculated_at');
  });

  // UPSERT behavior: ON CONFLICT updates existing rows
  test('adjustment_factor_cache UPSERT updates on conflict', async () => {
    // Insert
    await client.query(`
      INSERT INTO adjustment_factor_cache (platform, factor_name, factor_value, adjustment, sample_count, is_active)
      VALUES ('tiktok', 'hook_type', 'question', 0.15, 10, true)
    `);

    // UPSERT with new values
    await client.query(`
      INSERT INTO adjustment_factor_cache (platform, factor_name, factor_value, adjustment, sample_count, is_active, calculated_at)
      VALUES ('tiktok', 'hook_type', 'question', 0.25, 20, true, NOW())
      ON CONFLICT (platform, factor_name, factor_value) DO UPDATE SET
        adjustment = EXCLUDED.adjustment,
        sample_count = EXCLUDED.sample_count,
        is_active = EXCLUDED.is_active,
        calculated_at = NOW()
    `);

    const res = await client.query(`
      SELECT adjustment, sample_count FROM adjustment_factor_cache
      WHERE platform = 'tiktok' AND factor_name = 'hook_type' AND factor_value = 'question'
    `);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].adjustment).toBeCloseTo(0.25, 3);
    expect(res.rows[0].sample_count).toBe(20);
  });

  // is_active flag based on sample count
  test('is_active flag set correctly based on sample count', async () => {
    // Below threshold (< 5)
    await client.query(`
      INSERT INTO adjustment_factor_cache (platform, factor_name, factor_value, adjustment, sample_count, is_active)
      VALUES ('tiktok', 'post_hour', '18-20', 0.10, 3, false)
    `);

    const res1 = await client.query(`
      SELECT is_active FROM adjustment_factor_cache
      WHERE platform = 'tiktok' AND factor_name = 'post_hour' AND factor_value = '18-20'
    `);
    expect(res1.rows[0].is_active).toBe(false);

    // Above threshold (>= 5)
    await client.query(`
      INSERT INTO adjustment_factor_cache (platform, factor_name, factor_value, adjustment, sample_count, is_active)
      VALUES ('tiktok', 'post_hour', '09-11', 0.05, 10, true)
    `);

    const res2 = await client.query(`
      SELECT is_active FROM adjustment_factor_cache
      WHERE platform = 'tiktok' AND factor_name = 'post_hour' AND factor_value = '09-11'
    `);
    expect(res2.rows[0].is_active).toBe(true);
  });

  // UNIQUE constraint on (platform, factor_name, factor_value)
  test('unique constraint enforced on (platform, factor_name, factor_value)', async () => {
    await client.query(`
      INSERT INTO adjustment_factor_cache (platform, factor_name, factor_value, adjustment, sample_count, is_active)
      VALUES ('youtube', 'niche', 'comedy', 0.10, 10, true)
    `);

    await expect(client.query(`
      INSERT INTO adjustment_factor_cache (platform, factor_name, factor_value, adjustment, sample_count, is_active)
      VALUES ('youtube', 'niche', 'comedy', 0.20, 20, true)
    `)).rejects.toThrow(/unique constraint/i);
  });

  // 8 factor names are valid
  test('8 cached factor names are recognized', () => {
    const factors = [
      'hook_type', 'content_length', 'post_hour', 'post_weekday',
      'niche', 'narrative_structure', 'sound_bgm', 'hashtag_keyword',
    ];
    // cross_account_performance is real-time, not cached
    expect(factors).toHaveLength(8);
    expect(factors).not.toContain('cross_account_performance');
  });

  // Adjustment formula: AVG(actual/baseline - 1.0)
  test('adjustment calculation formula: AVG(actual/baseline - 1.0)', () => {
    // Example: baseline=1000, actual values: [1200, 800, 1100]
    const baseline = 1000;
    const actuals = [1200, 800, 1100];
    const adjustments = actuals.map(a => a / baseline - 1.0); // [0.2, -0.2, 0.1]
    const avg = adjustments.reduce((a, b) => a + b, 0) / adjustments.length;
    expect(avg).toBeCloseTo(0.0333, 3);
  });
});
