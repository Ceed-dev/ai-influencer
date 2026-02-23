/**
 * FEAT-ALG-005: KPI snapshot monthly generation batch
 * Spec: 08-algorithm-analysis.md §23 (G18)
 *
 * Monthly batch that calculates KPI achievement for each platform:
 * - Filters: posted_at >= 21st of month, measurement_point = '7d'
 * - achievement_rate = LEAST(1.0, avg_impressions / kpi_target)
 * - prediction_accuracy = 1 - AVG(prediction_error_7d) with edge case E2
 * - is_reliable = (account_count >= 5)
 * - UPSERT into kpi_snapshots
 */
import { getSettingNumber, getSharedPool, closeSettingsPool } from '../../lib/settings';
import type { Pool, PoolClient } from 'pg';

const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'x'] as const;
type Platform = typeof PLATFORMS[number];

const KPI_TARGET_KEYS: Record<Platform, string> = {
  tiktok: 'KPI_TARGET_TIKTOK',
  instagram: 'KPI_TARGET_INSTAGRAM',
  youtube: 'KPI_TARGET_YOUTUBE',
  x: 'KPI_TARGET_TWITTER',
};

interface KpiResult {
  platform: string;
  yearMonth: string;
  kpiTarget: number;
  avgImpressions: number;
  achievementRate: number;
  accountCount: number;
  publicationCount: number;
  predictionAccuracy: number | null;
  isReliable: boolean;
}

/**
 * Calculate KPI snapshot for a platform and month.
 */
export async function calcKpiForPlatform(
  client: PoolClient,
  platform: Platform,
  yearMonth: string,
): Promise<KpiResult | null> {
  const kpiTarget = await getSettingNumber(KPI_TARGET_KEYS[platform], client);
  const startDay = await getSettingNumber('KPI_CALC_MONTH_START_DAY', client);

  const [year, month] = yearMonth.split('-').map(Number);
  const nextMonthStart = new Date(Date.UTC(year, month, 1));
  const eligibleStart = new Date(Date.UTC(year, month - 1, startDay));

  const res = await client.query(`
    SELECT
      COUNT(DISTINCT p.id) AS publication_count,
      COUNT(DISTINCT p.account_id) AS account_count,
      AVG(m.views) AS avg_impressions,
      AVG(
        CASE
          WHEN ps.predicted_impressions = 0 AND ps.actual_impressions_7d = 0 THEN 0
          WHEN ps.actual_impressions_7d > 0 THEN
            ABS(ps.predicted_impressions - ps.actual_impressions_7d)::FLOAT / ps.actual_impressions_7d
          ELSE NULL
        END
      ) AS avg_error
    FROM publications p
    JOIN metrics m ON p.id = m.publication_id
    LEFT JOIN prediction_snapshots ps ON p.id = ps.publication_id
    WHERE p.platform = $1
      AND p.status = 'posted'
      AND p.posted_at >= $2
      AND p.posted_at < $3
      AND m.measurement_point = '7d'
      AND m.views IS NOT NULL
      AND ps.actual_impressions_7d IS NOT NULL
  `, [platform, eligibleStart.toISOString(), nextMonthStart.toISOString()]);

  const row = res.rows[0];
  const pubCount = parseInt(row.publication_count) || 0;
  const acctCount = parseInt(row.account_count) || 0;
  const avgImpressions = parseFloat(row.avg_impressions) || 0;
  const avgError = row.avg_error !== null ? parseFloat(row.avg_error) : null;

  if (pubCount === 0) return null;

  const achievementRate = Math.min(1.0, avgImpressions / kpiTarget);
  const predictionAccuracy = avgError !== null ? 1 - avgError : null;
  const isReliable = acctCount >= 5;

  return {
    platform,
    yearMonth,
    kpiTarget,
    avgImpressions,
    achievementRate,
    accountCount: acctCount,
    publicationCount: pubCount,
    predictionAccuracy,
    isReliable,
  };
}

/**
 * UPSERT a KPI result into kpi_snapshots.
 */
export async function upsertKpiSnapshot(
  client: PoolClient,
  kpi: KpiResult,
): Promise<void> {
  await client.query(`
    INSERT INTO kpi_snapshots (
      platform, year_month, kpi_target, avg_impressions,
      achievement_rate, account_count, publication_count,
      prediction_accuracy, is_reliable, calculated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (platform, year_month) DO UPDATE SET
      kpi_target = EXCLUDED.kpi_target,
      avg_impressions = EXCLUDED.avg_impressions,
      achievement_rate = EXCLUDED.achievement_rate,
      account_count = EXCLUDED.account_count,
      publication_count = EXCLUDED.publication_count,
      prediction_accuracy = EXCLUDED.prediction_accuracy,
      is_reliable = EXCLUDED.is_reliable,
      calculated_at = NOW()
  `, [
    kpi.platform, kpi.yearMonth, kpi.kpiTarget, kpi.avgImpressions,
    kpi.achievementRate, kpi.accountCount, kpi.publicationCount,
    kpi.predictionAccuracy, kpi.isReliable,
  ]);
}

/**
 * Run KPI snapshot generation for all platforms for a given month.
 */
export async function runKpiSnapshotGeneration(
  yearMonth?: string,
  pool?: Pool,
): Promise<KpiResult[]> {
  const db = pool || getSharedPool();
  const client = await db.connect();
  const results: KpiResult[] = [];

  if (!yearMonth) {
    const now = new Date();
    const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    yearMonth = `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  try {
    for (const platform of PLATFORMS) {
      const result = await calcKpiForPlatform(client, platform, yearMonth);
      if (result) {
        await upsertKpiSnapshot(client, result);
        results.push(result);
      }
    }
  } finally {
    client.release();
  }

  return results;
}

/** CLI entry point */
if (require.main === module) {
  const yearMonth = process.argv[2];
  (async () => {
    console.log(`Running KPI snapshot generation for ${yearMonth || 'previous month'}...`);
    const results = await runKpiSnapshotGeneration(yearMonth);
    for (const r of results) {
      console.log(`  ${r.platform} (${r.yearMonth}): achievement=${(r.achievementRate * 100).toFixed(1)}%, accuracy=${r.predictionAccuracy !== null ? (r.predictionAccuracy * 100).toFixed(1) + '%' : 'N/A'}, reliable=${r.isReliable}`);
    }
    await closeSettingsPool();
  })().catch((err) => {
    console.error('KPI snapshot generation failed:', err);
    process.exit(1);
  });
}
