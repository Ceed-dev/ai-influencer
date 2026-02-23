/**
 * FEAT-ALG-010: Prediction error calculation
 * Spec: 08-algorithm-analysis.md §12.3 (G19)
 *
 * After 7d and 30d measurement windows close, calculates prediction accuracy.
 * Called by measurement orchestrator (FEAT-ALG-006) after recording actual views.
 *
 * Formulas:
 *   7d:  prediction_error_7d  = ABS(predicted - actual_7d) / actual_7d
 *   30d: prediction_error_30d = ABS(predicted - actual_30d) / actual_30d
 *
 * Edge cases:
 *   E2: predicted=0 AND actual=0 → error=0 (perfect)
 *   E3: actual=0 AND predicted>0 → error=1.0 (max)
 *   actual=NULL → skip (account banned)
 */
import { getSharedPool, closeSettingsPool } from '../../lib/settings';
import type { Pool, PoolClient } from 'pg';

type ErrorRound = '7d' | '30d';

/**
 * Calculate prediction error for a single publication.
 */
export function calcPredictionError(
  predicted: number,
  actual: number,
): number {
  // E2: both zero → perfect prediction
  if (predicted === 0 && actual === 0) return 0;
  // E3: actual is zero but predicted > 0 → max error
  if (actual === 0) return 1.0;
  return Math.abs(predicted - actual) / actual;
}

/**
 * Update prediction_error for a publication after measurement.
 */
export async function updatePredictionError(
  client: PoolClient,
  publicationId: number,
  round: ErrorRound,
  actualViews: number,
): Promise<{ error: number | null }> {
  // Get predicted impressions
  const psRes = await client.query(
    'SELECT predicted_impressions FROM prediction_snapshots WHERE publication_id = $1',
    [publicationId],
  );

  if (psRes.rows.length === 0) return { error: null };

  const predicted = psRes.rows[0].predicted_impressions;
  const error = calcPredictionError(predicted, actualViews);

  const errorColumn = round === '7d' ? 'prediction_error_7d' : 'prediction_error_30d';

  await client.query(`
    UPDATE prediction_snapshots
    SET ${errorColumn} = $1, updated_at = NOW()
    WHERE publication_id = $2
  `, [error, publicationId]);

  return { error };
}

/**
 * Batch: recalculate prediction errors for all publications
 * that have actual measurements but missing error values.
 */
export async function batchRecalcErrors(
  pool?: Pool,
): Promise<{ updated7d: number; updated30d: number }> {
  const db = pool || getSharedPool();
  const client = await db.connect();
  let updated7d = 0;
  let updated30d = 0;

  try {
    // 7d errors
    const res7d = await client.query(`
      SELECT publication_id, predicted_impressions, actual_impressions_7d
      FROM prediction_snapshots
      WHERE actual_impressions_7d IS NOT NULL
        AND prediction_error_7d IS NULL
    `);

    for (const row of res7d.rows) {
      const error = calcPredictionError(row.predicted_impressions, row.actual_impressions_7d);
      await client.query(
        'UPDATE prediction_snapshots SET prediction_error_7d = $1, updated_at = NOW() WHERE publication_id = $2',
        [error, row.publication_id],
      );
      updated7d++;
    }

    // 30d errors
    const res30d = await client.query(`
      SELECT publication_id, predicted_impressions, actual_impressions_30d
      FROM prediction_snapshots
      WHERE actual_impressions_30d IS NOT NULL
        AND prediction_error_30d IS NULL
    `);

    for (const row of res30d.rows) {
      const error = calcPredictionError(row.predicted_impressions, row.actual_impressions_30d);
      await client.query(
        'UPDATE prediction_snapshots SET prediction_error_30d = $1, updated_at = NOW() WHERE publication_id = $2',
        [error, row.publication_id],
      );
      updated30d++;
    }
  } finally {
    client.release();
  }

  return { updated7d, updated30d };
}

/** CLI entry point */
if (require.main === module) {
  (async () => {
    console.log('Running prediction error recalculation...');
    const result = await batchRecalcErrors();
    console.log(`  7d: ${result.updated7d} updated, 30d: ${result.updated30d} updated`);
    await closeSettingsPool();
  })().catch((err) => {
    console.error('Prediction error recalc failed:', err);
    process.exit(1);
  });
}
