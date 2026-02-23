/**
 * FEAT-ALG-006: Measurement job orchestration
 * Spec: 08-algorithm-analysis.md §20 (G19)
 *
 * Hourly batch polling with 3 rounds:
 *   Round 1 (48h): posted_at + 48h → actual_impressions_48h → micro-analysis queue
 *   Round 2 (7d):  posted_at + 7d  → actual_impressions_7d + prediction_error_7d → cumulative queue
 *   Round 3 (30d): posted_at + 30d → actual_impressions_30d + prediction_error_30d → storage only
 *
 * Idempotent: only processes NULL actual_impressions_Xd entries.
 * Platform API calls are handled by measure-agent adapters (not implemented here).
 * This module provides the orchestration layer.
 */
import { getSharedPool, closeSettingsPool } from '../../lib/settings';
import type { Pool, PoolClient } from 'pg';

interface MeasurementTarget {
  publicationId: number;
  accountId: string;
  platform: string;
  postedAt: Date;
  contentId: string;
  predictedImpressions: number;
}

type MeasurementRound = '48h' | '7d' | '30d';

const ROUND_CONFIG: Record<MeasurementRound, {
  interval: string;
  actualColumn: string;
  errorColumn: string | null;
  analysisQueue: string | null;
}> = {
  '48h': {
    interval: '48 hours',
    actualColumn: 'actual_impressions_48h',
    errorColumn: null, // No error calc for 48h
    analysisQueue: 'micro_analysis',
  },
  '7d': {
    interval: '7 days',
    actualColumn: 'actual_impressions_7d',
    errorColumn: 'prediction_error_7d',
    analysisQueue: 'cumulative_analysis',
  },
  '30d': {
    interval: '30 days',
    actualColumn: 'actual_impressions_30d',
    errorColumn: 'prediction_error_30d',
    analysisQueue: null, // Storage only
  },
};

/**
 * Get publications eligible for measurement in a given round.
 */
export async function getTargets(
  client: PoolClient,
  round: MeasurementRound,
): Promise<MeasurementTarget[]> {
  const config = ROUND_CONFIG[round];

  const sql = `
    SELECT p.id AS publication_id, p.account_id, p.platform, p.posted_at,
           ps.content_id, ps.predicted_impressions
    FROM publications p
    JOIN prediction_snapshots ps ON p.id = ps.publication_id
    WHERE ps.${config.actualColumn} IS NULL
      AND p.posted_at + INTERVAL '${config.interval}' <= NOW()
      AND p.status = 'posted'
    ORDER BY p.posted_at ASC
  `;

  const res = await client.query(sql);
  return res.rows.map((r: any) => ({
    publicationId: r.publication_id,
    accountId: r.account_id,
    platform: r.platform,
    postedAt: new Date(r.posted_at),
    contentId: r.content_id,
    predictedImpressions: r.predicted_impressions,
  }));
}

/**
 * Record a measurement result for a publication.
 * Updates prediction_snapshots with actual impressions and error.
 * Also UPSERTs metrics table.
 */
export async function recordMeasurement(
  client: PoolClient,
  publicationId: number,
  round: MeasurementRound,
  views: number,
): Promise<void> {
  const config = ROUND_CONFIG[round];

  // Update prediction_snapshots
  if (config.errorColumn) {
    // Calculate prediction error: ABS(predicted - actual) / NULLIF(actual, 0)
    await client.query(`
      UPDATE prediction_snapshots
      SET ${config.actualColumn} = $1,
          ${config.errorColumn} = CASE WHEN $1 > 0
            THEN ABS(predicted_impressions - $1)::FLOAT / $1
            ELSE NULL END,
          updated_at = NOW()
      WHERE publication_id = $2
    `, [views, publicationId]);
  } else {
    await client.query(`
      UPDATE prediction_snapshots
      SET ${config.actualColumn} = $1, updated_at = NOW()
      WHERE publication_id = $2
    `, [views, publicationId]);
  }

  // UPSERT metrics
  await client.query(`
    INSERT INTO metrics (publication_id, views, measurement_point, measured_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (publication_id, measurement_point) DO UPDATE SET
      views = $2, measured_at = NOW()
  `, [publicationId, views, round]);
}

/**
 * Enqueue analysis task after measurement.
 * (Placeholder — actual queue implementation depends on task_queue structure)
 */
export async function enqueueAnalysis(
  client: PoolClient,
  round: MeasurementRound,
  contentId: string,
  publicationId: number,
): Promise<void> {
  const config = ROUND_CONFIG[round];
  if (!config.analysisQueue) return; // 30d → no analysis

  await client.query(`
    INSERT INTO task_queue (task_type, payload, status, priority, created_at)
    VALUES ('measure', $1, 'pending', 0, NOW())
  `, [JSON.stringify({
    analysis_type: config.analysisQueue,
    content_id: contentId,
    publication_id: publicationId,
    round,
  })]);
}

/**
 * Process a single measurement round.
 * Returns number of publications processed.
 *
 * Note: This provides the orchestration framework. Actual platform API calls
 * are handled by measure-agent adapters that call recordMeasurement().
 */
export async function processRound(
  client: PoolClient,
  round: MeasurementRound,
  fetchViews?: (target: MeasurementTarget) => Promise<number | null>,
): Promise<{ processed: number; skipped: number }> {
  const targets = await getTargets(client, round);
  let processed = 0;
  let skipped = 0;

  for (const target of targets) {
    try {
      // If a fetchViews function is provided, use it; otherwise skip (dry run)
      const views = fetchViews ? await fetchViews(target) : null;
      if (views === null) {
        skipped++;
        continue;
      }

      await recordMeasurement(client, target.publicationId, round, views);
      await enqueueAnalysis(client, round, target.contentId, target.publicationId);
      processed++;
    } catch {
      // API failure → skip → retry next hour (idempotent)
      skipped++;
    }
  }

  return { processed, skipped };
}

/**
 * Run measurement orchestration for all 3 rounds.
 */
export async function runMeasurementOrchestration(
  pool?: Pool,
  fetchViews?: (target: MeasurementTarget) => Promise<number | null>,
): Promise<Record<MeasurementRound, { processed: number; skipped: number }>> {
  const db = pool || getSharedPool();
  const client = await db.connect();
  const results = {} as Record<MeasurementRound, { processed: number; skipped: number }>;

  try {
    for (const round of ['48h', '7d', '30d'] as MeasurementRound[]) {
      results[round] = await processRound(client, round, fetchViews);
    }
  } finally {
    client.release();
  }

  return results;
}

/** CLI entry point */
if (require.main === module) {
  (async () => {
    console.log('Starting measurement orchestration (dry run)...');
    const results = await runMeasurementOrchestration();
    for (const [round, result] of Object.entries(results)) {
      console.log(`  ${round}: ${result.processed} processed, ${result.skipped} skipped`);
    }
    await closeSettingsPool();
  })().catch((err) => {
    console.error('Measurement orchestration failed:', err);
    process.exit(1);
  });
}
