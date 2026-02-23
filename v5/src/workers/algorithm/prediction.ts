/**
 * FEAT-ALG-004: Prediction pipeline
 * Spec: 08-algorithm-analysis.md §15.3 (G5)
 *
 * Called after publication INSERT, before API posting.
 * Creates prediction_snapshots with predicted_impressions.
 *
 * Flow:
 * 1. Get baseline from account_baselines (fallback to real-time)
 * 2. Get 8 adjustments from adjustment_factor_cache
 * 3. Calculate cross_account_performance in real-time (G4)
 * 4. Individual clip per factor
 * 5. Total clip
 * 6. Predicted = baseline × (1 + total_adj), value-clipped
 * 7. INSERT into prediction_snapshots
 */
import { getSettingNumber, getSharedPool, closeSettingsPool } from '../../lib/settings';
import type { Pool, PoolClient } from 'pg';

const FACTORS = [
  'hook_type', 'content_length', 'post_hour', 'post_weekday',
  'niche', 'narrative_structure', 'sound_bgm', 'hashtag_keyword',
  'cross_account_performance',
] as const;

interface AdjustmentDetail {
  value: string;
  adjustment: number;
  weight: number;
}

interface PredictionResult {
  publicationId: number;
  baseline: number;
  baselineSource: string;
  totalAdjustment: number;
  predictedImpressions: number;
  adjustmentsApplied: Record<string, AdjustmentDetail>;
}

/**
 * Get baseline for an account.
 * Falls back to real-time calculation if no cached baseline exists.
 */
async function getBaseline(
  client: PoolClient,
  accountId: string,
): Promise<{ baseline: number; source: string }> {
  // Try cached baseline first
  const res = await client.query(
    'SELECT baseline_impressions, source FROM account_baselines WHERE account_id = $1',
    [accountId]
  );
  if (res.rows.length > 0) {
    return { baseline: res.rows[0].baseline_impressions, source: res.rows[0].source };
  }

  // Real-time fallback: compute from own metrics
  const ownRes = await client.query(`
    SELECT AVG(m.views) AS avg_views, COUNT(*) AS cnt
    FROM publications p
    JOIN metrics m ON p.id = m.publication_id
    WHERE p.account_id = $1 AND m.measurement_point = '7d'
      AND m.measured_at >= NOW() - INTERVAL '14 days'
  `, [accountId]);

  if (ownRes.rows[0]?.cnt >= 3 && ownRes.rows[0]?.avg_views) {
    return { baseline: parseFloat(ownRes.rows[0].avg_views), source: 'own_history' };
  }

  // Default fallback
  const defaultVal = await getSettingNumber('BASELINE_DEFAULT_IMPRESSIONS', client);
  return { baseline: defaultVal, source: 'default' };
}

/**
 * Get weights for a platform from prediction_weights.
 */
async function getWeights(
  client: PoolClient,
  platform: string,
): Promise<Record<string, number>> {
  const res = await client.query(
    'SELECT factor_name, weight FROM prediction_weights WHERE platform = $1',
    [platform]
  );
  const weights: Record<string, number> = {};
  for (const row of res.rows) {
    weights[row.factor_name as string] = row.weight;
  }
  // Fill missing factors with uniform weight
  for (const f of FACTORS) {
    if (!(f in weights)) weights[f] = 1 / FACTORS.length;
  }
  return weights;
}

/**
 * Get cached adjustments for 8 factors.
 * cross_account_performance is calculated separately.
 */
async function getCachedAdjustments(
  client: PoolClient,
  platform: string,
  factorValues: Record<string, string | null>,
): Promise<Record<string, { adjustment: number; value: string }>> {
  const result: Record<string, { adjustment: number; value: string }> = {};

  for (const [factorName, factorValue] of Object.entries(factorValues)) {
    if (!factorValue) {
      result[factorName] = { adjustment: 0, value: 'NULL' };
      continue;
    }
    const res = await client.query(`
      SELECT adjustment FROM adjustment_factor_cache
      WHERE platform = $1 AND factor_name = $2 AND factor_value = $3 AND is_active = true
    `, [platform, factorName, factorValue]);
    if (res.rows.length > 0) {
      result[factorName] = { adjustment: res.rows[0].adjustment, value: factorValue };
    } else {
      result[factorName] = { adjustment: 0, value: factorValue };
    }
  }
  return result;
}

/**
 * Calculate cross_account_performance in real-time (G4).
 * Same content_id posted to other accounts on the same platform.
 */
async function calcCrossAccountPerformance(
  client: PoolClient,
  contentId: string,
  platform: string,
  excludeAccountId: string,
  minSample: number,
): Promise<number> {
  const res = await client.query(`
    SELECT AVG(m.views / ps.baseline_used - 1.0) AS cross_adj
    FROM prediction_snapshots ps
    JOIN publications p ON ps.publication_id = p.id
    JOIN accounts a ON p.account_id = a.account_id
    JOIN metrics m ON p.id = m.publication_id
    WHERE ps.content_id = $1
      AND a.platform = $2
      AND p.account_id != $3
      AND m.measurement_point = '7d'
      AND ps.baseline_used > 0
    HAVING COUNT(*) >= $4
  `, [contentId, platform, excludeAccountId, minSample]);

  if (res.rows.length > 0 && res.rows[0].cross_adj !== null) {
    return parseFloat(res.rows[0].cross_adj);
  }
  return 0; // No data → adj = 0
}

/**
 * Resolve factor values for a publication.
 */
async function resolveFactorValues(
  client: PoolClient,
  publicationId: number,
  contentId: string,
): Promise<Record<string, string | null>> {
  // Get content data
  const contentRes = await client.query(`
    SELECT c.hook_type, c.narrative_structure, c.total_duration_seconds,
           p.posted_at, a.niche, p.metadata AS pub_metadata, a.platform
    FROM publications p
    JOIN accounts a ON p.account_id = a.account_id
    JOIN content c ON p.content_id = c.content_id
    WHERE p.id = $1
  `, [publicationId]);

  if (contentRes.rows.length === 0) return {};
  const row = contentRes.rows[0];

  const values: Record<string, string | null> = {
    hook_type: row.hook_type || null,
    niche: row.niche || null,
    narrative_structure: row.narrative_structure || null,
  };

  // content_length bucket
  if (row.total_duration_seconds != null) {
    const dur = parseFloat(row.total_duration_seconds);
    if (dur <= 15) values['content_length'] = '0-15s';
    else if (dur <= 30) values['content_length'] = '16-30s';
    else if (dur <= 60) values['content_length'] = '31-60s';
    else values['content_length'] = '60s+';
  } else {
    values['content_length'] = null;
  }

  // post_hour bucket
  if (row.posted_at) {
    const hour = new Date(row.posted_at).getUTCHours();
    if (hour <= 5) values['post_hour'] = '00-05';
    else if (hour <= 8) values['post_hour'] = '06-08';
    else if (hour <= 11) values['post_hour'] = '09-11';
    else if (hour <= 14) values['post_hour'] = '12-14';
    else if (hour <= 17) values['post_hour'] = '15-17';
    else if (hour <= 20) values['post_hour'] = '18-20';
    else values['post_hour'] = '21-23';
  } else {
    values['post_hour'] = null;
  }

  // post_weekday
  if (row.posted_at) {
    values['post_weekday'] = String(new Date(row.posted_at).getUTCDay());
  } else {
    values['post_weekday'] = null;
  }

  // sound_bgm (from components via content_sections)
  const bgmRes = await client.query(`
    SELECT comp.data->>'bgm_category' AS bgm
    FROM content_sections cs
    JOIN components comp ON cs.component_id = comp.id
    WHERE cs.content_id = $1 AND comp.component_type = 'audio'
    LIMIT 1
  `, [contentId]);
  values['sound_bgm'] = bgmRes.rows[0]?.bgm || null;

  // hashtag_keyword (first/most common tag from publication metadata)
  if (row.pub_metadata?.tags && Array.isArray(row.pub_metadata.tags) && row.pub_metadata.tags.length > 0) {
    values['hashtag_keyword'] = row.pub_metadata.tags[0];
  } else {
    values['hashtag_keyword'] = null;
  }

  return values;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Create a prediction snapshot for a publication.
 */
export async function createPrediction(
  publicationId: number,
  contentId: string,
  accountId: string,
  hypothesisId: number | null,
  pool?: Pool,
): Promise<PredictionResult> {
  const db = pool || getSharedPool();
  const client = await db.connect();

  try {
    // Get platform
    const pubRes = await client.query(
      'SELECT platform FROM publications WHERE id = $1', [publicationId]
    );
    const platform = pubRes.rows[0]?.platform;
    if (!platform) throw new Error(`Publication ${publicationId} not found`);

    // Read clip settings
    const [adjIndMin, adjIndMax, adjTotalMin, adjTotalMax, predMinRatio, predMaxRatio, crossMinSample] =
      await Promise.all([
        getSettingNumber('ADJUSTMENT_INDIVIDUAL_MIN', client),
        getSettingNumber('ADJUSTMENT_INDIVIDUAL_MAX', client),
        getSettingNumber('ADJUSTMENT_TOTAL_MIN', client),
        getSettingNumber('ADJUSTMENT_TOTAL_MAX', client),
        getSettingNumber('PREDICTION_VALUE_MIN_RATIO', client),
        getSettingNumber('PREDICTION_VALUE_MAX_RATIO', client),
        getSettingNumber('CROSS_ACCOUNT_MIN_SAMPLE', client),
      ]);

    // Step 1: Get baseline
    const { baseline, source: baselineSource } = await getBaseline(client, accountId);

    // Step 2: Get weights
    const weights = await getWeights(client, platform);

    // Step 3: Get factor values and cached adjustments
    const factorValues = await resolveFactorValues(client, publicationId, contentId);
    const cachedAdj = await getCachedAdjustments(client, platform, factorValues);

    // Step 4: Cross-account real-time calculation
    const crossAdj = await calcCrossAccountPerformance(
      client, contentId, platform, accountId, crossMinSample
    );

    // Build adjustments_applied JSONB
    const adjustmentsApplied: Record<string, AdjustmentDetail> = {};
    let totalAdj = 0;

    for (const factor of FACTORS) {
      let adj: number;
      let value: string;

      if (factor === 'cross_account_performance') {
        adj = crossAdj;
        value = String(crossAdj);
      } else {
        adj = cachedAdj[factor]?.adjustment ?? 0;
        value = cachedAdj[factor]?.value ?? 'NULL';
      }

      // Individual clip
      adj = clamp(adj, adjIndMin, adjIndMax);
      const w = weights[factor] ?? (1 / FACTORS.length);

      adjustmentsApplied[factor] = { value, adjustment: adj, weight: w };
      totalAdj += w * adj;
    }

    // Total clip
    totalAdj = clamp(totalAdj, adjTotalMin, adjTotalMax);

    // Predicted impressions + value clip
    let predicted = baseline * (1 + totalAdj);
    predicted = clamp(predicted, baseline * predMinRatio, baseline * predMaxRatio);

    // Step 5: INSERT prediction_snapshots
    await client.query(`
      INSERT INTO prediction_snapshots (
        publication_id, content_id, account_id, hypothesis_id,
        baseline_used, baseline_source, adjustments_applied,
        total_adjustment, predicted_impressions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (publication_id) DO UPDATE SET
        baseline_used = EXCLUDED.baseline_used,
        baseline_source = EXCLUDED.baseline_source,
        adjustments_applied = EXCLUDED.adjustments_applied,
        total_adjustment = EXCLUDED.total_adjustment,
        predicted_impressions = EXCLUDED.predicted_impressions,
        updated_at = NOW()
    `, [
      publicationId, contentId, accountId, hypothesisId,
      baseline, baselineSource, JSON.stringify(adjustmentsApplied),
      totalAdj, predicted,
    ]);

    return {
      publicationId,
      baseline,
      baselineSource,
      totalAdjustment: totalAdj,
      predictedImpressions: predicted,
      adjustmentsApplied,
    };
  } finally {
    client.release();
  }
}
