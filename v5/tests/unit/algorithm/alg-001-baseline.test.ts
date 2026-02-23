/**
 * FEAT-ALG-001: Daily baseline calculation batch
 * Tests: TEST-ALG-001, TEST-ALG-002, TEST-ALG-028, TEST-ALG-029
 */
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://dev:dev@localhost:5433/dev_ai_influencer';

// We test the baseline SQL directly rather than importing the module,
// since we need fine-grained transaction control for test isolation.

async function createClient(): Promise<Client> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

// ======== TEST-ALG-028 & TEST-ALG-029 (table/settings verification) ========

describe('FEAT-ALG-001: Algorithm infrastructure', () => {
  let client: Client;

  beforeAll(async () => { client = await createClient(); });
  afterAll(async () => { await client.end(); });

  test('TEST-ALG-028: 6 algorithm tables exist', async () => {
    const tables = [
      'prediction_weights', 'weight_audit_log', 'prediction_snapshots',
      'kpi_snapshots', 'account_baselines', 'adjustment_factor_cache',
    ];
    const res = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [tables]
    );
    const found = res.rows.map((r: any) => r.table_name).sort();
    expect(found).toEqual(tables.sort());
  });

  test('TEST-ALG-029: 31 algorithm system_settings keys exist', async () => {
    const keys = [
      'ADJUSTMENT_INDIVIDUAL_MIN', 'ADJUSTMENT_INDIVIDUAL_MAX',
      'ADJUSTMENT_TOTAL_MIN', 'ADJUSTMENT_TOTAL_MAX',
      'WEIGHT_RECALC_TIER_1_THRESHOLD', 'WEIGHT_RECALC_TIER_1_INTERVAL',
      'WEIGHT_RECALC_TIER_2_THRESHOLD', 'WEIGHT_RECALC_TIER_2_INTERVAL',
      'WEIGHT_RECALC_TIER_3_THRESHOLD', 'WEIGHT_RECALC_TIER_3_INTERVAL',
      'WEIGHT_RECALC_TIER_4_INTERVAL', 'WEIGHT_RECALC_MIN_NEW_DATA',
      'WEIGHT_SMOOTHING_ALPHA', 'WEIGHT_CHANGE_MAX_RATE', 'WEIGHT_FLOOR',
      'ADJUSTMENT_DATA_DECAY_DAYS', 'BASELINE_WINDOW_DAYS', 'BASELINE_MIN_SAMPLE',
      'KPI_CALC_MONTH_START_DAY', 'KPI_TARGET_TIKTOK', 'KPI_TARGET_INSTAGRAM',
      'KPI_TARGET_YOUTUBE', 'KPI_TARGET_TWITTER', 'PREDICTION_VALUE_MIN_RATIO',
      'PREDICTION_VALUE_MAX_RATIO', 'CUMULATIVE_SEARCH_TOP_K',
      'CUMULATIVE_SIMILARITY_THRESHOLD', 'CUMULATIVE_CONFIDENCE_THRESHOLD',
      'BASELINE_DEFAULT_IMPRESSIONS', 'EMBEDDING_MODEL_VERSION',
      'CROSS_ACCOUNT_MIN_SAMPLE',
    ];
    const res = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM system_settings WHERE setting_key = ANY($1)`,
      [keys]
    );
    expect(res.rows[0].cnt).toBe(31);
  });
});

// ======== TEST-ALG-001 & TEST-ALG-002 (baseline calculation logic) ========

describe('FEAT-ALG-001: Baseline calculation batch', () => {
  let client: Client;

  beforeAll(async () => { client = await createClient(); });
  afterAll(async () => { await client.end(); });

  // Use savepoints for test isolation
  beforeEach(async () => { await client.query('BEGIN'); });
  afterEach(async () => { await client.query('ROLLBACK'); });

  /**
   * Helper: read BASELINE_* settings
   */
  async function getBaselineConfig() {
    const res = await client.query(
      `SELECT setting_key, setting_value FROM system_settings
       WHERE setting_key IN ('BASELINE_WINDOW_DAYS', 'BASELINE_MIN_SAMPLE', 'BASELINE_DEFAULT_IMPRESSIONS')`
    );
    const cfg: Record<string, number> = {};
    for (const r of res.rows) {
      cfg[r.setting_key as string] = Number(r.setting_value);
    }
    return cfg;
  }

  /**
   * Helper: run the baseline UPSERT SQL (same logic as baseline.ts but using test client)
   */
  async function runBaselineSQL(windowDays: number, minSample: number, defaultImpressions: number) {
    const sql = `
      WITH own_history AS (
        SELECT
          a.account_id,
          AVG(m.views) AS baseline_imp,
          COUNT(*) AS sample_count,
          MIN(m.measured_at)::DATE AS window_start,
          MAX(m.measured_at)::DATE AS window_end
        FROM accounts a
        JOIN publications p ON a.account_id = p.account_id
        JOIN metrics m ON p.id = m.publication_id
        WHERE a.status = 'active'
          AND m.measurement_point = '7d'
          AND m.measured_at >= NOW() - ($1 || ' days')::INTERVAL
        GROUP BY a.account_id
        HAVING COUNT(*) >= $2
      ),
      cohort_niche_age AS (
        SELECT
          a2.account_id,
          AVG(m2.views) AS baseline_imp,
          COUNT(*) AS sample_count
        FROM accounts a2
        JOIN publications p2 ON a2.account_id = p2.account_id
        JOIN metrics m2 ON p2.id = m2.publication_id
        WHERE a2.status = 'active'
          AND m2.measurement_point = '7d'
          AND m2.measured_at >= NOW() - INTERVAL '90 days'
        GROUP BY a2.account_id, a2.platform, a2.niche,
          CASE
            WHEN EXTRACT(DAY FROM NOW() - a2.created_at) <= 30 THEN 'new'
            WHEN EXTRACT(DAY FROM NOW() - a2.created_at) <= 60 THEN 'young'
            WHEN EXTRACT(DAY FROM NOW() - a2.created_at) <= 90 THEN 'growing'
            WHEN EXTRACT(DAY FROM NOW() - a2.created_at) <= 180 THEN 'established'
            WHEN EXTRACT(DAY FROM NOW() - a2.created_at) <= 365 THEN 'mature'
            ELSE 'veteran'
          END
        HAVING COUNT(*) >= $2
      ),
      cohort_niche AS (
        SELECT a3.platform, a3.niche,
          AVG(m3.views) AS baseline_imp, COUNT(*) AS sample_count
        FROM accounts a3
        JOIN publications p3 ON a3.account_id = p3.account_id
        JOIN metrics m3 ON p3.id = m3.publication_id
        WHERE m3.measurement_point = '7d'
          AND m3.measured_at >= NOW() - INTERVAL '90 days'
        GROUP BY a3.platform, a3.niche
        HAVING COUNT(*) >= $2
      ),
      cohort_platform AS (
        SELECT a4.platform,
          AVG(m4.views) AS baseline_imp, COUNT(*) AS sample_count
        FROM accounts a4
        JOIN publications p4 ON a4.account_id = p4.account_id
        JOIN metrics m4 ON p4.id = m4.publication_id
        WHERE m4.measurement_point = '7d'
          AND m4.measured_at >= NOW() - INTERVAL '90 days'
        GROUP BY a4.platform
        HAVING COUNT(*) >= $2
      ),
      final AS (
        SELECT
          a.account_id,
          COALESCE(oh.baseline_imp, cna.baseline_imp, cn.baseline_imp, cp.baseline_imp, $3) AS baseline_impressions,
          CASE
            WHEN oh.sample_count IS NOT NULL THEN 'own_history'
            WHEN cna.sample_count IS NOT NULL THEN 'cohort'
            WHEN cn.sample_count IS NOT NULL THEN 'cohort'
            WHEN cp.sample_count IS NOT NULL THEN 'cohort'
            ELSE 'default'
          END AS source,
          COALESCE(oh.sample_count, cna.sample_count, cn.sample_count, cp.sample_count, 0)::INTEGER AS sample_count,
          COALESCE(oh.window_start, CURRENT_DATE - 90) AS window_start,
          COALESCE(oh.window_end, CURRENT_DATE) AS window_end
        FROM accounts a
        LEFT JOIN own_history oh ON a.account_id = oh.account_id
        LEFT JOIN cohort_niche_age cna ON a.account_id = cna.account_id
        LEFT JOIN cohort_niche cn ON a.platform = cn.platform AND a.niche = cn.niche
        LEFT JOIN cohort_platform cp ON a.platform = cp.platform
        WHERE a.status = 'active'
      )
      INSERT INTO account_baselines (account_id, baseline_impressions, source, sample_count, window_start, window_end, calculated_at)
      SELECT account_id, baseline_impressions, source, sample_count, window_start, window_end, NOW()
      FROM final
      ON CONFLICT (account_id) DO UPDATE SET
        baseline_impressions = EXCLUDED.baseline_impressions,
        source = EXCLUDED.source,
        sample_count = EXCLUDED.sample_count,
        window_start = EXCLUDED.window_start,
        window_end = EXCLUDED.window_end,
        calculated_at = NOW()
    `;
    return client.query(sql, [windowDays, minSample, defaultImpressions]);
  }

  /**
   * Helper: insert a test character
   */
  async function insertCharacter(charId: string) {
    await client.query(`
      INSERT INTO characters (character_id, name, voice_id)
      VALUES ($1, 'Test Char', 'voice_001')
      ON CONFLICT (character_id) DO NOTHING
    `, [charId]);
  }

  /**
   * Helper: insert a test account
   */
  async function insertAccount(accountId: string, platform: string, niche: string, charId: string, createdDaysAgo = 100) {
    await insertCharacter(charId);
    await client.query(`
      INSERT INTO accounts (account_id, platform, niche, character_id, status, created_at)
      VALUES ($1, $2, $3, $4, 'active', NOW() - ($5 || ' days')::INTERVAL)
      ON CONFLICT (account_id) DO NOTHING
    `, [accountId, platform, niche, charId, createdDaysAgo]);
  }

  /**
   * Helper: insert content + publication + metrics for an account
   */
  async function insertMetrics(accountId: string, platform: string, contentIdPrefix: string, views: number[], daysAgoArr: number[]) {
    for (let i = 0; i < views.length; i++) {
      const contentId = `${contentIdPrefix}${i}`;
      // Insert content
      await client.query(`
        INSERT INTO content (content_id, status, content_format)
        VALUES ($1, 'posted', 'short_video')
        ON CONFLICT (content_id) DO NOTHING
      `, [contentId]);
      // Insert publication
      const pubRes = await client.query(`
        INSERT INTO publications (content_id, account_id, platform, status, posted_at)
        VALUES ($1, $2, $3, 'posted', NOW() - ($4 || ' days')::INTERVAL)
        RETURNING id
      `, [contentId, accountId, platform, daysAgoArr[i]]);
      const pubId = pubRes.rows[0].id;
      // Insert metric (7d measurement)
      await client.query(`
        INSERT INTO metrics (publication_id, views, measurement_point, measured_at)
        VALUES ($1, $2, '7d', NOW() - ($3 || ' days')::INTERVAL)
        ON CONFLICT (publication_id, measurement_point) DO NOTHING
      `, [pubId, views[i], daysAgoArr[i]]);
    }
  }

  // TEST-ALG-001: own_history normal case
  test('TEST-ALG-001: baseline calculation — own_history normal', async () => {
    const cfg = await getBaselineConfig();
    expect(cfg.BASELINE_WINDOW_DAYS).toBe(14);
    expect(cfg.BASELINE_MIN_SAMPLE).toBe(3);

    // Create account with sufficient own history (10 data points within 14 days)
    await insertAccount('BA001', 'tiktok', 'comedy', 'CH_BA01', 100);

    const views = [1000, 1200, 800, 1100, 900, 1300, 1050, 950, 1150, 1000];
    const daysAgo = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // all within 14-day window
    await insertMetrics('BA001', 'tiktok', 'CBA01_', views, daysAgo);

    // Run baseline batch
    await runBaselineSQL(cfg.BASELINE_WINDOW_DAYS, cfg.BASELINE_MIN_SAMPLE, cfg.BASELINE_DEFAULT_IMPRESSIONS);

    // Verify
    const res = await client.query(
      `SELECT baseline_impressions, source, sample_count FROM account_baselines WHERE account_id = 'BA001'`
    );
    expect(res.rows).toHaveLength(1);
    const row = res.rows[0];
    expect(row.source).toBe('own_history');
    expect(row.sample_count).toBe(10);

    // Average should be (1000+1200+800+1100+900+1300+1050+950+1150+1000)/10 = 1045
    expect(row.baseline_impressions).toBeCloseTo(1045, 0);
  });

  // TEST-ALG-002: cohort fallback when own_history is insufficient
  test('TEST-ALG-002: baseline calculation — cohort fallback chain', async () => {
    const cfg = await getBaselineConfig();

    // Create test account with only 2 metrics (< BASELINE_MIN_SAMPLE=3)
    await insertAccount('BA002', 'tiktok', 'comedy', 'CH_BA02', 100);
    await insertMetrics('BA002', 'tiktok', 'CBA02_', [500, 600], [1, 2]);

    // Create cohort accounts (same platform×niche×age_bucket) with sufficient data
    // These accounts are also ~100 days old, so age_bucket = 'growing' or 'established'
    for (let i = 1; i <= 5; i++) {
      const accId = `BAC0${i}`;
      const charId = `CHC0${i}`;
      await insertAccount(accId, 'tiktok', 'comedy', charId, 100);
      // Each cohort account gets 3+ metrics within 90 days
      await insertMetrics(accId, 'tiktok', `CBC0${i}_`, [2000, 2200, 1800], [5, 10, 15]);
    }

    // Run baseline batch
    await runBaselineSQL(cfg.BASELINE_WINDOW_DAYS, cfg.BASELINE_MIN_SAMPLE, cfg.BASELINE_DEFAULT_IMPRESSIONS);

    // The test account BA002 should fallback to cohort since own_history has only 2 samples
    const res = await client.query(
      `SELECT baseline_impressions, source, sample_count FROM account_baselines WHERE account_id = 'BA002'`
    );
    expect(res.rows).toHaveLength(1);
    const row = res.rows[0];
    expect(row.source).toBe('cohort');
    expect(row.sample_count).toBeGreaterThanOrEqual(3);
  });

  // Additional test: default fallback when no cohort data exists
  test('baseline calculation — default fallback (E1)', async () => {
    const cfg = await getBaselineConfig();

    // Create isolated account with unique platform/niche combo, no metrics at all
    await insertAccount('BA003', 'instagram', 'science', 'CH_BA03', 10);

    // Run baseline batch
    await runBaselineSQL(cfg.BASELINE_WINDOW_DAYS, cfg.BASELINE_MIN_SAMPLE, cfg.BASELINE_DEFAULT_IMPRESSIONS);

    // Should fall back to default
    const res = await client.query(
      `SELECT baseline_impressions, source, sample_count FROM account_baselines WHERE account_id = 'BA003'`
    );
    expect(res.rows).toHaveLength(1);
    const row = res.rows[0];
    expect(row.source).toBe('default');
    expect(row.baseline_impressions).toBe(500);
    expect(row.sample_count).toBe(0);
  });
});
