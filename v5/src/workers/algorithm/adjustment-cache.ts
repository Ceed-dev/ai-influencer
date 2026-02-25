/**
 * FEAT-ALG-003: Adjustment factor cache update batch
 * Spec: 08-algorithm-analysis.md §17 (G8, G17)
 *
 * Computes 8 adjustment factors per platform and UPSERTs into adjustment_factor_cache.
 * cross_account_performance is real-time (not cached here).
 *
 * Each factor: AVG(actual/baseline - 1.0) grouped by factor_value bucket.
 * Minimum sample: 5 (ANALYSIS_MIN_SAMPLE_SIZE default).
 */
import { getSharedPool, closeSettingsPool } from '../../lib/settings';
import type { Pool, PoolClient } from 'pg';

const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;

/**
 * Common base CTE for all factor calculations.
 * Joins prediction_snapshots + publications + accounts + metrics + content.
 */
const BASE_CTE = `
  WITH base AS (
    SELECT
      ps.id, ps.baseline_used, ps.account_id, ps.content_id,
      m.views AS actual,
      p.posted_at, a.niche, a.platform,
      c.hook_type, c.narrative_structure, c.total_duration_seconds,
      p.metadata AS pub_metadata
    FROM prediction_snapshots ps
    JOIN publications p ON ps.publication_id = p.id
    JOIN accounts a ON p.account_id = a.account_id
    JOIN metrics m ON p.id = m.publication_id
    JOIN content c ON ps.content_id = c.content_id
    WHERE a.platform = $1
      AND ps.created_at > NOW() - INTERVAL '90 days'
      AND ps.baseline_used > 0
      AND m.measurement_point = '7d'
  )
`;

interface FactorResult {
  factor_value: string;
  adjustment: number;
  sample_count: number;
}

/**
 * Calculate adjustments for a single factor.
 */
async function calculateFactor(
  client: PoolClient,
  platform: string,
  factorName: string,
  factorSQL: string,
  minSample: number,
): Promise<FactorResult[]> {
  const sql = `${BASE_CTE} ${factorSQL}`;
  const res = await client.query(sql, [platform]);
  return res.rows
    .filter((r: any) => r.sample_count >= minSample)
    .map((r: any) => ({
      factor_value: r.factor_value,
      adjustment: parseFloat(r.adjustment) || 0,
      sample_count: parseInt(r.sample_count),
    }));
}

/**
 * Factor-specific SQL fragments (after the base CTE).
 */
const FACTOR_SQLS: Record<string, string> = {
  hook_type: `
    SELECT
      hook_type AS factor_value,
      AVG(actual / baseline_used - 1.0) AS adjustment,
      COUNT(*)::int AS sample_count
    FROM base
    WHERE hook_type IS NOT NULL
    GROUP BY hook_type
  `,

  content_length: `
    SELECT
      CASE
        WHEN total_duration_seconds IS NOT NULL AND total_duration_seconds <= 15 THEN '0-15s'
        WHEN total_duration_seconds IS NOT NULL AND total_duration_seconds <= 30 THEN '16-30s'
        WHEN total_duration_seconds IS NOT NULL AND total_duration_seconds <= 60 THEN '31-60s'
        WHEN total_duration_seconds IS NOT NULL THEN '60s+'
        ELSE NULL
      END AS factor_value,
      AVG(actual / baseline_used - 1.0) AS adjustment,
      COUNT(*)::int AS sample_count
    FROM base
    WHERE total_duration_seconds IS NOT NULL
    GROUP BY 1
  `,

  post_hour: `
    SELECT
      CASE
        WHEN EXTRACT(HOUR FROM posted_at) BETWEEN 0 AND 5 THEN '00-05'
        WHEN EXTRACT(HOUR FROM posted_at) BETWEEN 6 AND 8 THEN '06-08'
        WHEN EXTRACT(HOUR FROM posted_at) BETWEEN 9 AND 11 THEN '09-11'
        WHEN EXTRACT(HOUR FROM posted_at) BETWEEN 12 AND 14 THEN '12-14'
        WHEN EXTRACT(HOUR FROM posted_at) BETWEEN 15 AND 17 THEN '15-17'
        WHEN EXTRACT(HOUR FROM posted_at) BETWEEN 18 AND 20 THEN '18-20'
        ELSE '21-23'
      END AS factor_value,
      AVG(actual / baseline_used - 1.0) AS adjustment,
      COUNT(*)::int AS sample_count
    FROM base
    WHERE posted_at IS NOT NULL
    GROUP BY 1
  `,

  post_weekday: `
    SELECT
      EXTRACT(DOW FROM posted_at)::int::text AS factor_value,
      AVG(actual / baseline_used - 1.0) AS adjustment,
      COUNT(*)::int AS sample_count
    FROM base
    WHERE posted_at IS NOT NULL
    GROUP BY 1
  `,

  niche: `
    SELECT
      niche AS factor_value,
      AVG(actual / baseline_used - 1.0) AS adjustment,
      COUNT(*)::int AS sample_count
    FROM base
    WHERE niche IS NOT NULL
    GROUP BY niche
  `,

  narrative_structure: `
    SELECT
      narrative_structure AS factor_value,
      AVG(actual / baseline_used - 1.0) AS adjustment,
      COUNT(*)::int AS sample_count
    FROM base
    WHERE narrative_structure IS NOT NULL
    GROUP BY narrative_structure
  `,

  sound_bgm: `
    SELECT
      comp.data->>'bgm_category' AS factor_value,
      AVG(base.actual / base.baseline_used - 1.0) AS adjustment,
      COUNT(*)::int AS sample_count
    FROM base
    JOIN content_sections cs ON base.content_id = cs.content_id
    JOIN components comp ON cs.component_id = comp.component_id
    WHERE comp.type = 'audio'
      AND comp.data->>'bgm_category' IS NOT NULL
    GROUP BY comp.data->>'bgm_category'
  `,

  hashtag_keyword: `
    SELECT
      tag AS factor_value,
      AVG(actual / baseline_used - 1.0) AS adjustment,
      COUNT(*)::int AS sample_count
    FROM base,
      jsonb_array_elements_text(pub_metadata->'tags') AS tag
    GROUP BY tag
  `,
};

/**
 * UPSERT results into adjustment_factor_cache for one factor.
 */
async function upsertFactorCache(
  client: PoolClient,
  platform: string,
  factorName: string,
  results: FactorResult[],
  minSample: number,
): Promise<number> {
  let count = 0;
  for (const r of results) {
    await client.query(`
      INSERT INTO adjustment_factor_cache (platform, factor_name, factor_value, adjustment, sample_count, is_active, calculated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (platform, factor_name, factor_value) DO UPDATE SET
        adjustment = EXCLUDED.adjustment,
        sample_count = EXCLUDED.sample_count,
        is_active = EXCLUDED.is_active,
        calculated_at = NOW()
    `, [platform, factorName, r.factor_value, r.adjustment, r.sample_count, r.sample_count >= minSample]);
    count++;
  }
  return count;
}

/**
 * Run adjustment factor cache update for a single platform.
 */
export async function updateAdjustmentCacheForPlatform(
  platform: string,
  client: PoolClient,
  minSample = 5,
): Promise<{ factorCounts: Record<string, number> }> {
  const factorCounts: Record<string, number> = {};

  for (const [factorName, factorSQL] of Object.entries(FACTOR_SQLS)) {
    const results = await calculateFactor(client, platform, factorName, factorSQL, minSample);
    const count = await upsertFactorCache(client, platform, factorName, results, minSample);
    factorCounts[factorName] = count;
  }

  return { factorCounts };
}

/**
 * Run adjustment factor cache update for all platforms.
 */
export async function runAdjustmentCacheUpdate(pool?: Pool): Promise<Record<string, { factorCounts: Record<string, number> }>> {
  const db = pool || getSharedPool();
  const client = await db.connect();
  const results: Record<string, { factorCounts: Record<string, number> }> = {};
  try {
    for (const platform of PLATFORMS) {
      results[platform] = await updateAdjustmentCacheForPlatform(platform, client);
    }
  } finally {
    client.release();
  }
  return results;
}

/** CLI entry point */
if (require.main === module) {
  (async () => {
    console.log('Starting adjustment factor cache update...');
    const results = await runAdjustmentCacheUpdate();
    for (const [platform, result] of Object.entries(results)) {
      const total = Object.values(result.factorCounts).reduce((a, b) => a + b, 0);
      console.log(`  ${platform}: ${total} cache entries updated`);
    }
    await closeSettingsPool();
  })().catch((err) => {
    console.error('Adjustment cache update failed:', err);
    process.exit(1);
  });
}
