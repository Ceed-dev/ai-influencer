/**
 * FEAT-ALG-009: cross_account_performance calculation
 * Spec: 08-algorithm-analysis.md §G4
 *
 * For a given content piece, calculates how the same content performed
 * across OTHER accounts on the same platform to use as a correction factor.
 *
 * Formula: AVG(actual / baseline_used - 1.0) across other accounts
 * Constraints:
 * - Within-platform only (cross-platform excluded)
 * - Minimum sample: CROSS_ACCOUNT_MIN_SAMPLE (default: 2)
 * - Returns 0 if insufficient data
 */
import { getSettingNumber, getSharedPool, closeSettingsPool } from '../../lib/settings';
import type { Pool, PoolClient } from 'pg';

interface CrossAccountResult {
  contentId: string;
  platform: string;
  excludeAccountId: string;
  adjustment: number;
  sampleCount: number;
  accountIds: string[];
}

/**
 * Calculate cross_account_performance for a content piece.
 */
export async function calcCrossAccountPerformance(
  client: PoolClient,
  contentId: string,
  platform: string,
  excludeAccountId: string,
  minSample?: number,
): Promise<CrossAccountResult> {
  const minCount = minSample ?? await getSettingNumber('CROSS_ACCOUNT_MIN_SAMPLE', client);

  const res = await client.query(`
    SELECT
      AVG(m.views / NULLIF(ps.baseline_used, 0) - 1.0) AS cross_adj,
      COUNT(*)::int AS sample_count,
      ARRAY_AGG(DISTINCT p.account_id) AS account_ids
    FROM prediction_snapshots ps
    JOIN publications p ON ps.publication_id = p.id
    JOIN metrics m ON p.id = m.publication_id
    WHERE ps.content_id = $1
      AND p.platform = $2
      AND p.account_id != $3
      AND m.measurement_point = '7d'
      AND ps.baseline_used > 0
    HAVING COUNT(*) >= $4
  `, [contentId, platform, excludeAccountId, minCount]);

  if (res.rows.length > 0 && res.rows[0].cross_adj !== null) {
    return {
      contentId, platform, excludeAccountId,
      adjustment: parseFloat(res.rows[0].cross_adj),
      sampleCount: res.rows[0].sample_count,
      accountIds: res.rows[0].account_ids || [],
    };
  }

  return { contentId, platform, excludeAccountId, adjustment: 0, sampleCount: 0, accountIds: [] };
}

/**
 * Batch: calculate cross_account for publications that have it missing.
 */
export async function batchCrossAccountUpdate(pool?: Pool): Promise<{ updated: number }> {
  const db = pool || getSharedPool();
  const client = await db.connect();
  let updated = 0;

  try {
    const pubs = await client.query(`
      SELECT ps.publication_id, ps.content_id, p.account_id, p.platform
      FROM prediction_snapshots ps
      JOIN publications p ON ps.publication_id = p.id
      WHERE (ps.adjustments_applied->>'cross_account_performance') IS NULL
         OR ps.adjustments_applied->'cross_account_performance'->>'adjustment' = '0'
      LIMIT 100
    `);

    for (const pub of pubs.rows) {
      const result = await calcCrossAccountPerformance(
        client, pub.content_id, pub.platform, pub.account_id,
      );
      if (result.adjustment !== 0) {
        await client.query(`
          UPDATE prediction_snapshots
          SET adjustments_applied = jsonb_set(
            adjustments_applied, '{cross_account_performance}', $1::jsonb
          ), updated_at = NOW()
          WHERE publication_id = $2
        `, [
          JSON.stringify({ value: String(result.adjustment), adjustment: result.adjustment, weight: 0.1111 }),
          pub.publication_id,
        ]);
        updated++;
      }
    }
  } finally {
    client.release();
  }
  return { updated };
}

/** CLI entry point */
if (require.main === module) {
  (async () => {
    console.log('Running cross_account_performance batch update...');
    const result = await batchCrossAccountUpdate();
    console.log(`  Updated: ${result.updated} publications`);
    await closeSettingsPool();
  })().catch((err) => { console.error('Cross-account batch failed:', err); process.exit(1); });
}
