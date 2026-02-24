/**
 * FEAT-ALG-001: Daily baseline calculation batch
 * Spec: 08-algorithm-analysis.md §16.3 (G15)
 *
 * Runs daily at UTC 01:00 for all active accounts.
 * Fallback chain: own_history → cohort(platform×niche×age) → cohort(platform×niche) → cohort(platform) → default(500)
 *
 * Config from system_settings:
 *   BASELINE_WINDOW_DAYS (14)
 *   BASELINE_MIN_SAMPLE (3)
 *   BASELINE_DEFAULT_IMPRESSIONS (500)
 */
import { getSettingNumber, getSharedPool, closeSettingsPool } from '../../lib/settings';
import type { Pool } from 'pg';

/**
 * Build and execute the baseline UPSERT SQL.
 * Reads config from system_settings, then runs a single CTE-based UPSERT.
 */
export async function runBaselineUpdate(pool?: Pool): Promise<{ rowCount: number }> {
  const db = pool || getSharedPool();

  // Read config from system_settings (no hardcoding)
  const client = await db.connect();
  try {
    const windowDays = await getSettingNumber('BASELINE_WINDOW_DAYS', client);
    const minSample = await getSettingNumber('BASELINE_MIN_SAMPLE', client);
    const defaultImpressions = await getSettingNumber('BASELINE_DEFAULT_IMPRESSIONS', client);

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
          AND m.measured_at >= NOW() - make_interval(days => $1::int)
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

    const result = await client.query(sql, [windowDays, minSample, defaultImpressions]);
    return { rowCount: result.rowCount || 0 };
  } finally {
    client.release();
  }
}

/** CLI entry point */
if (require.main === module) {
  (async () => {
    console.log('Starting daily baseline update...');
    const result = await runBaselineUpdate();
    console.log(`Baseline update complete. Rows affected: ${result.rowCount}`);
    await closeSettingsPool();
  })().catch((err) => {
    console.error('Baseline update failed:', err);
    process.exit(1);
  });
}
