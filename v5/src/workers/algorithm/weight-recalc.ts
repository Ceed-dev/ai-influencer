/**
 * FEAT-ALG-002: Weight recalculation batch
 * Spec: 08-algorithm-analysis.md §18 (G1, G9, G11, G16)
 *
 * Per-platform batch:
 * 1. Tier determination (metrics count → recalc interval)
 * 2. Min new data check (skip if < WEIGHT_RECALC_MIN_NEW_DATA)
 * 3. Error correlation → raw_contribution per factor
 * 4. EMA smoothing (α = WEIGHT_SMOOTHING_ALPHA)
 * 5. ±WEIGHT_CHANGE_MAX_RATE clip
 * 6. WEIGHT_FLOOR enforcement
 * 7. Normalize to sum=1.0
 * 8. prediction_weights UPDATE + weight_audit_log INSERT (transaction)
 */
import { getSettingNumber, getSettingString, getSharedPool, closeSettingsPool } from '../../lib/settings';
import type { Pool, PoolClient } from 'pg';

const FACTORS = [
  'hook_type', 'content_length', 'post_hour', 'post_weekday',
  'niche', 'narrative_structure', 'sound_bgm', 'hashtag_keyword',
  'cross_account_performance',
] as const;

const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;

interface TierConfig {
  tier: number;
  interval: string;
}

/**
 * Determine recalculation tier based on metrics count for a platform.
 */
export function determineTier(
  metricsCount: number,
  thresholds: { t1: number; t2: number; t3: number },
): TierConfig & { metricsCount: number } {
  if (metricsCount >= thresholds.t3) {
    return { tier: 4, interval: '12h', metricsCount };
  } else if (metricsCount >= thresholds.t2) {
    return { tier: 3, interval: '1d', metricsCount };
  } else if (metricsCount >= thresholds.t1) {
    return { tier: 2, interval: '3d', metricsCount };
  }
  return { tier: 1, interval: '7d', metricsCount };
}

/**
 * Parse interval string (e.g. "7d", "12h") to hours
 */
function intervalToHours(interval: string): number {
  const match = interval.match(/^(\d+)(d|h)$/);
  if (!match) return 168; // 7 days default
  const val = parseInt(match[1] ?? '7');
  return match[2] === 'd' ? val * 24 : val;
}

/**
 * Run weight recalculation for a single platform.
 * Returns true if recalculation was performed, false if skipped.
 */
export async function recalcWeightsForPlatform(
  platform: string,
  client: PoolClient,
): Promise<{ performed: boolean; reason?: string }> {
  // Read config
  const [t1, t2, t3, minNewData, alpha, maxRate, floor] = await Promise.all([
    getSettingNumber('WEIGHT_RECALC_TIER_1_THRESHOLD', client),
    getSettingNumber('WEIGHT_RECALC_TIER_2_THRESHOLD', client),
    getSettingNumber('WEIGHT_RECALC_TIER_3_THRESHOLD', client),
    getSettingNumber('WEIGHT_RECALC_MIN_NEW_DATA', client),
    getSettingNumber('WEIGHT_SMOOTHING_ALPHA', client),
    getSettingNumber('WEIGHT_CHANGE_MAX_RATE', client),
    getSettingNumber('WEIGHT_FLOOR', client),
  ]);

  // Step 1: Count metrics for tier determination
  const countRes = await client.query(`
    SELECT COUNT(*)::int AS cnt
    FROM metrics m
    JOIN publications p ON m.publication_id = p.id
    JOIN accounts a ON p.account_id = a.account_id
    WHERE a.platform = $1
  `, [platform]);
  const metricsCount = countRes.rows[0].cnt;
  const tierInfo = determineTier(metricsCount, { t1, t2, t3 });

  // Step 2: Check interval since last recalculation
  const lastRecalcRes = await client.query(`
    SELECT MAX(calculated_at) AS last_calc
    FROM weight_audit_log
    WHERE platform = $1
  `, [platform]);
  const lastCalc = lastRecalcRes.rows[0]?.last_calc;
  if (lastCalc) {
    const hoursSince = (Date.now() - new Date(lastCalc).getTime()) / (1000 * 60 * 60);
    const requiredHours = intervalToHours(tierInfo.interval);
    if (hoursSince < requiredHours) {
      return { performed: false, reason: `interval not elapsed (${hoursSince.toFixed(1)}h < ${requiredHours}h)` };
    }
  }

  // Step 3: Count new data since last recalculation
  let newDataCount: number;
  if (lastCalc) {
    const newDataRes = await client.query(`
      SELECT COUNT(*)::int AS cnt
      FROM metrics m
      JOIN publications p ON m.publication_id = p.id
      JOIN accounts a ON p.account_id = a.account_id
      WHERE a.platform = $1 AND m.measured_at > $2
    `, [platform, lastCalc]);
    newDataCount = newDataRes.rows[0].cnt;
  } else {
    newDataCount = metricsCount; // First run: all data is "new"
  }
  if (newDataCount < minNewData) {
    return { performed: false, reason: `insufficient new data (${newDataCount} < ${minNewData})` };
  }

  // Step 4: Get current weights
  const currentWeightsRes = await client.query(`
    SELECT factor_name, weight FROM prediction_weights WHERE platform = $1
  `, [platform]);
  const oldWeights: Record<string, number> = {};
  for (const row of currentWeightsRes.rows) {
    oldWeights[row.factor_name as string] = row.weight;
  }

  // Step 5: Calculate raw contributions via error correlation (G1)
  const contributionRes = await client.query(`
    WITH factor_data AS (
      SELECT
        f.factor_name,
        (ps.adjustments_applied->f.factor_name->>'adjustment')::FLOAT AS adj,
        (ps.adjustments_applied->f.factor_name->>'weight')::FLOAT AS w,
        m.views AS actual,
        ps.baseline_used AS baseline
      FROM prediction_snapshots ps
      JOIN publications p ON ps.publication_id = p.id
      JOIN accounts a ON p.account_id = a.account_id
      JOIN metrics m ON p.id = m.publication_id
      CROSS JOIN (VALUES
        ('hook_type'),('content_length'),('post_hour'),('post_weekday'),
        ('niche'),('narrative_structure'),('sound_bgm'),('hashtag_keyword'),
        ('cross_account_performance')
      ) AS f(factor_name)
      WHERE a.platform = $1
        AND ps.prediction_error_7d IS NOT NULL
        AND ps.created_at > NOW() - INTERVAL '90 days'
        AND m.measurement_point = '7d'
    ),
    contributions AS (
      SELECT
        factor_name,
        AVG(CASE WHEN SIGN(adj * (actual - baseline)) > 0 THEN 1.0 ELSE 0.0 END) AS direction_accuracy,
        AVG(ABS(adj * w)) AS avg_impact
      FROM factor_data
      WHERE adj IS NOT NULL
      GROUP BY factor_name
    )
    SELECT
      factor_name,
      direction_accuracy * avg_impact AS raw_contribution
    FROM contributions
  `, [platform]);

  // Build raw contributions map
  const rawContributions: Record<string, number> = {};
  for (const f of FACTORS) rawContributions[f] = 0;
  for (const row of contributionRes.rows) {
    rawContributions[row.factor_name as string] = row.raw_contribution || 0;
  }

  // Step 6: Normalize to calculated weights
  const totalContribution = Object.values(rawContributions).reduce((a, b) => a + b, 0);
  const calculatedWeights: Record<string, number> = {};
  if (totalContribution === 0) {
    // Uniform fallback
    for (const f of FACTORS) calculatedWeights[f] = 1 / FACTORS.length;
  } else {
    for (const f of FACTORS) calculatedWeights[f] = (rawContributions[f] ?? 0) / totalContribution;
  }

  // Step 7-10: EMA → clip → floor → normalize
  const emaWeights: Record<string, number> = {};
  for (const f of FACTORS) {
    const old = oldWeights[f] ?? (1 / FACTORS.length);
    const calc = calculatedWeights[f] ?? (1 / FACTORS.length);
    // EMA
    let ema = alpha * calc + (1 - alpha) * old;
    // Clip to ±maxRate of old
    const lo = old * (1 - maxRate);
    const hi = old * (1 + maxRate);
    ema = Math.max(lo, Math.min(hi, ema));
    // Floor
    ema = Math.max(floor, ema);
    emaWeights[f] = ema;
  }

  // Final normalization (sum=1.0)
  const emaTotal = Object.values(emaWeights).reduce((a, b) => a + b, 0);
  const finalWeights: Record<string, number> = {};
  for (const f of FACTORS) {
    finalWeights[f] = (emaWeights[f] ?? 0) / emaTotal;
  }

  // Step 11: Transaction — UPDATE prediction_weights + INSERT weight_audit_log
  const dataCount = contributionRes.rowCount || 0;
  await client.query('SAVEPOINT weight_update');
  try {
    for (const f of FACTORS) {
      await client.query(`
        UPDATE prediction_weights SET weight = $1, updated_at = NOW()
        WHERE platform = $2 AND factor_name = $3
      `, [finalWeights[f], platform, f]);

      await client.query(`
        INSERT INTO weight_audit_log (platform, factor_name, old_weight, new_weight, data_count, metrics_count, calculated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [platform, f, oldWeights[f] ?? (1 / FACTORS.length), finalWeights[f], dataCount, metricsCount]);
    }
    await client.query('RELEASE SAVEPOINT weight_update');
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT weight_update');
    throw err;
  }

  return { performed: true };
}

/**
 * Run weight recalculation for all platforms.
 */
export async function runWeightRecalculation(pool?: Pool): Promise<Record<string, { performed: boolean; reason?: string }>> {
  const db = pool || getSharedPool();
  const client = await db.connect();
  const results: Record<string, { performed: boolean; reason?: string }> = {};
  try {
    for (const platform of PLATFORMS) {
      results[platform] = await recalcWeightsForPlatform(platform, client);
    }
  } finally {
    client.release();
  }
  return results;
}

/** CLI entry point */
if (require.main === module) {
  (async () => {
    console.log('Starting weight recalculation...');
    const results = await runWeightRecalculation();
    for (const [platform, result] of Object.entries(results)) {
      console.log(`  ${platform}: ${result.performed ? 'recalculated' : `skipped (${result.reason})`}`);
    }
    await closeSettingsPool();
  })().catch((err) => {
    console.error('Weight recalculation failed:', err);
    process.exit(1);
  });
}
