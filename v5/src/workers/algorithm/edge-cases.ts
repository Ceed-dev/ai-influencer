/**
 * FEAT-ALG-011: Edge case handling (E1-E10)
 * Spec: 08-algorithm-analysis.md §24
 *
 * E1: No cohort data → 4-stage fallback chain (platform×niche×age → platform×niche → platform → default(500))
 * E2: predicted=0 AND actual=0 → accuracy=1.0
 * E3: actual=NULL (account banned) → exclude from ALL KPI/accuracy calcs
 * E5: account_count < 5 → is_reliable=FALSE in kpi_snapshots
 * E6: Cohort size < BASELINE_MIN_SAMPLE → cascade to next fallback
 * E7: All 9 factors = 0 (cold start) → predicted=baseline, cold_start=true
 */
import type { PoolClient } from 'pg';

/**
 * E2: Handle zero-zero prediction accuracy.
 * Returns error rate (0 = perfect, 1 = max).
 */
export function handleE2Accuracy(predicted: number, actual: number): number | null {
  if (actual === null || actual === undefined) return null; // E3
  if (predicted === 0 && actual === 0) return 0; // E2: perfect
  if (actual === 0) return 1.0; // predicted>0 but actual=0 → max error
  return Math.abs(predicted - actual) / actual;
}

/**
 * E3: Check if a publication should be excluded from KPI calculations.
 * Returns true if the publication should be EXCLUDED (e.g., banned account).
 */
export function shouldExcludeFromKpi(actualImpressions7d: number | null): boolean {
  return actualImpressions7d === null;
}

/**
 * E5: Determine if a KPI snapshot is reliable.
 * Returns false if account_count < 5.
 */
export function isKpiReliable(accountCount: number): boolean {
  return accountCount >= 5;
}

/**
 * E7: Detect cold start — all 9 adjustment factors are zero.
 * Returns true if cold start detected.
 */
export function isColdStart(
  adjustmentsApplied: Record<string, { adjustment: number }>,
): boolean {
  const factors = Object.values(adjustmentsApplied);
  if (factors.length === 0) return true;
  return factors.every(f => f.adjustment === 0);
}

/**
 * E7: Build cold start adjustments_applied JSONB.
 * All factors get adj=0 and cold_start flag is set.
 */
export function buildColdStartAdjustments(
  weights: Record<string, number>,
): Record<string, { value: string; adjustment: number; weight: number }> & { cold_start?: string } {
  const result: Record<string, any> = {};
  for (const [factor, weight] of Object.entries(weights)) {
    result[factor] = { value: 'NULL', adjustment: 0, weight };
  }
  result['cold_start'] = 'true';
  return result;
}

/**
 * E1/E6: Baseline fallback chain.
 * 4-stage: platform×niche×age → platform×niche → platform → default(500)
 */
export async function baselineFallbackChain(
  client: PoolClient,
  accountId: string,
  platform: string,
  niche: string | null,
  accountAgeDays: number,
  minSample: number,
  defaultBaseline: number,
): Promise<{ baseline: number; source: string }> {
  // Stage 1: platform × niche × age bucket
  if (niche) {
    const ageBucket = accountAgeDays <= 30 ? '0-30'
      : accountAgeDays <= 90 ? '31-90'
      : accountAgeDays <= 180 ? '91-180'
      : '180+';

    const r1 = await client.query(`
      SELECT AVG(m.views) AS avg_views, COUNT(*)::int AS cnt
      FROM publications p
      JOIN metrics m ON p.id = m.publication_id
      JOIN accounts a ON p.account_id = a.account_id
      WHERE a.platform = $1 AND a.niche = $2
        AND m.measurement_point = '7d'
        AND CASE
          WHEN $3 = '0-30' THEN a.created_at >= NOW() - INTERVAL '30 days'
          WHEN $3 = '31-90' THEN a.created_at >= NOW() - INTERVAL '90 days' AND a.created_at < NOW() - INTERVAL '30 days'
          WHEN $3 = '91-180' THEN a.created_at >= NOW() - INTERVAL '180 days' AND a.created_at < NOW() - INTERVAL '90 days'
          ELSE a.created_at < NOW() - INTERVAL '180 days'
        END
    `, [platform, niche, ageBucket]);

    if (r1.rows[0]?.cnt >= minSample && r1.rows[0]?.avg_views) {
      return { baseline: parseFloat(r1.rows[0].avg_views), source: 'cohort_niche_age' };
    }

    // Stage 2: platform × niche
    const r2 = await client.query(`
      SELECT AVG(m.views) AS avg_views, COUNT(*)::int AS cnt
      FROM publications p
      JOIN metrics m ON p.id = m.publication_id
      JOIN accounts a ON p.account_id = a.account_id
      WHERE a.platform = $1 AND a.niche = $2
        AND m.measurement_point = '7d'
    `, [platform, niche]);

    if (r2.rows[0]?.cnt >= minSample && r2.rows[0]?.avg_views) {
      return { baseline: parseFloat(r2.rows[0].avg_views), source: 'cohort_niche' };
    }
  }

  // Stage 3: platform only
  const r3 = await client.query(`
    SELECT AVG(m.views) AS avg_views, COUNT(*)::int AS cnt
    FROM publications p
    JOIN metrics m ON p.id = m.publication_id
    JOIN accounts a ON p.account_id = a.account_id
    WHERE a.platform = $1
      AND m.measurement_point = '7d'
  `, [platform]);

  if (r3.rows[0]?.cnt >= minSample && r3.rows[0]?.avg_views) {
    return { baseline: parseFloat(r3.rows[0].avg_views), source: 'cohort_platform' };
  }

  // Stage 4: default
  return { baseline: defaultBaseline, source: 'default' };
}
