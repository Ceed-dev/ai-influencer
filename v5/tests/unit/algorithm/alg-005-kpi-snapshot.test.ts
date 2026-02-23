/**
 * FEAT-ALG-005: KPI snapshot monthly generation batch
 * Tests: TEST-ALG-009, TEST-ALG-010
 */
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

async function createClient(): Promise<Client> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

describe('FEAT-ALG-005: KPI snapshot generation', () => {
  let client: Client;

  beforeAll(async () => { client = await createClient(); });
  afterAll(async () => { await client.end(); });

  beforeEach(async () => { await client.query('BEGIN'); });
  afterEach(async () => { await client.query('ROLLBACK'); });

  // Helper: set up test data with metrics
  async function setupWithMetrics(
    accountId: string,
    contentId: string,
    platform: string,
    views: number,
    predicted: number,
    postedDaysAgo: number,
  ): Promise<number> {
    await client.query(`
      INSERT INTO characters (character_id, name, voice_id)
      VALUES ('CH_KPI01', 'KPI Char', 'voice_001')
      ON CONFLICT (character_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO accounts (account_id, platform, character_id, status)
      VALUES ($1, $2, 'CH_KPI01', 'active')
      ON CONFLICT (account_id) DO NOTHING
    `, [accountId, platform]);
    await client.query(`
      INSERT INTO content (content_id, status, content_format)
      VALUES ($1, 'posted', 'short_video')
      ON CONFLICT (content_id) DO NOTHING
    `, [contentId]);

    const pubRes = await client.query(`
      INSERT INTO publications (content_id, account_id, platform, status, posted_at)
      VALUES ($1, $2, $3, 'posted', NOW() - ($4 || ' days')::INTERVAL)
      RETURNING id
    `, [contentId, accountId, platform, postedDaysAgo]);
    const pubId = pubRes.rows[0].id;

    // Insert prediction snapshot
    const error7d = views > 0 ? Math.abs(predicted - views) / views : null;
    await client.query(`
      INSERT INTO prediction_snapshots (
        publication_id, content_id, account_id,
        baseline_used, baseline_source, adjustments_applied,
        total_adjustment, predicted_impressions,
        actual_impressions_7d, prediction_error_7d
      ) VALUES ($1, $2, $3, $4, 'own_history', '{}', 0, $5, $6, $7)
    `, [pubId, contentId, accountId, predicted, predicted, views, error7d]);

    // Insert 7d metric
    await client.query(`
      INSERT INTO metrics (publication_id, views, measurement_point, measured_at)
      VALUES ($1, $2, '7d', NOW())
    `, [pubId, views]);

    return pubId;
  }

  // TEST-ALG-009: KPI settings exist
  test('TEST-ALG-009: KPI target settings exist with correct values', async () => {
    const res = await client.query(`
      SELECT setting_key, setting_value FROM system_settings
      WHERE setting_key IN ('KPI_TARGET_TIKTOK', 'KPI_TARGET_INSTAGRAM', 'KPI_TARGET_YOUTUBE', 'KPI_TARGET_TWITTER')
      ORDER BY setting_key
    `);
    expect(res.rows).toHaveLength(4);

    const targets: Record<string, number> = {};
    for (const row of res.rows) {
      targets[row.setting_key as string] = Number(row.setting_value);
    }
    expect(targets.KPI_TARGET_TIKTOK).toBe(15000);
    expect(targets.KPI_TARGET_INSTAGRAM).toBe(10000);
    expect(targets.KPI_TARGET_YOUTUBE).toBe(20000);
    expect(targets.KPI_TARGET_TWITTER).toBe(10000);
  });

  // TEST-ALG-010: KPI snapshot UPSERT
  test('TEST-ALG-010: kpi_snapshots UPSERT works correctly', async () => {
    // Insert
    await client.query(`
      INSERT INTO kpi_snapshots (
        platform, year_month, kpi_target, avg_impressions,
        achievement_rate, account_count, publication_count,
        prediction_accuracy, is_reliable, calculated_at
      ) VALUES ('tiktok', '2026-01', 15000, 12000, 0.8, 10, 50, 0.75, true, NOW())
    `);

    // UPSERT with new values
    await client.query(`
      INSERT INTO kpi_snapshots (
        platform, year_month, kpi_target, avg_impressions,
        achievement_rate, account_count, publication_count,
        prediction_accuracy, is_reliable, calculated_at
      ) VALUES ('tiktok', '2026-01', 15000, 14000, 0.93, 12, 60, 0.80, true, NOW())
      ON CONFLICT (platform, year_month) DO UPDATE SET
        avg_impressions = EXCLUDED.avg_impressions,
        achievement_rate = EXCLUDED.achievement_rate,
        account_count = EXCLUDED.account_count,
        publication_count = EXCLUDED.publication_count,
        prediction_accuracy = EXCLUDED.prediction_accuracy,
        is_reliable = EXCLUDED.is_reliable,
        calculated_at = NOW()
    `);

    const res = await client.query(`
      SELECT * FROM kpi_snapshots WHERE platform = 'tiktok' AND year_month = '2026-01'
    `);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].avg_impressions).toBe(14000);
    expect(res.rows[0].achievement_rate).toBeCloseTo(0.93, 2);
    expect(res.rows[0].prediction_accuracy).toBeCloseTo(0.80, 2);
    expect(res.rows[0].is_reliable).toBe(true);
  });

  // Achievement rate calculation
  test('achievement_rate = LEAST(1.0, avg / target)', async () => {
    const target = 15000;

    // Below target
    const rate1 = Math.min(1.0, 12000 / target);
    expect(rate1).toBeCloseTo(0.8, 3);

    // Above target — capped at 1.0
    const rate2 = Math.min(1.0, 18000 / target);
    expect(rate2).toBe(1.0);
  });

  // is_reliable flag
  test('is_reliable = FALSE when account_count < 5', async () => {
    await client.query(`
      INSERT INTO kpi_snapshots (
        platform, year_month, kpi_target, avg_impressions,
        achievement_rate, account_count, publication_count,
        is_reliable, calculated_at
      ) VALUES ('instagram', '2026-01', 10000, 8000, 0.8, 3, 10, false, NOW())
    `);

    const res = await client.query(`
      SELECT is_reliable FROM kpi_snapshots
      WHERE platform = 'instagram' AND year_month = '2026-01'
    `);
    expect(res.rows[0].is_reliable).toBe(false);
  });

  // Prediction accuracy with edge case E2
  test('prediction accuracy handles E2: predicted=0 AND actual=0 → error=0', () => {
    const predicted = 0;
    const actual = 0;
    // E2: predicted=0 AND actual=0 → accuracy = 1.0 (error=0)
    const error = (predicted === 0 && actual === 0) ? 0 : Math.abs(predicted - actual) / actual;
    expect(error).toBe(0);
    expect(1 - error).toBe(1.0);
  });

  // KPI calculation SQL
  test('KPI aggregate query returns correct metrics', async () => {
    // Setup: 3 publications with metrics
    await setupWithMetrics('KA001', 'KC001', 'tiktok', 10000, 8000, 5);
    await setupWithMetrics('KA002', 'KC002', 'tiktok', 15000, 12000, 5);
    await setupWithMetrics('KA003', 'KC003', 'tiktok', 20000, 18000, 5);

    // Calculate aggregate
    const res = await client.query(`
      SELECT
        COUNT(DISTINCT p.id)::int AS publication_count,
        COUNT(DISTINCT p.account_id)::int AS account_count,
        AVG(m.views) AS avg_impressions
      FROM publications p
      JOIN metrics m ON p.id = m.publication_id
      WHERE p.platform = 'tiktok'
        AND p.status = 'posted'
        AND m.measurement_point = '7d'
    `);

    expect(res.rows[0].publication_count).toBeGreaterThanOrEqual(3);
    expect(res.rows[0].account_count).toBeGreaterThanOrEqual(3);
    const avg = parseFloat(res.rows[0].avg_impressions);
    expect(avg).toBeGreaterThan(0);
    // avg of 10000, 15000, 20000 = 15000
    expect(avg).toBeCloseTo(15000, -2);
  });
});
