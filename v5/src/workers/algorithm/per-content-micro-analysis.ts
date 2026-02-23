/**
 * ALG-007: Per-content micro-analysis
 * Spec: 08-algorithm-analysis.md
 *
 * After measurement, runs per-content micro-analysis:
 * 1. Get predicted KPIs (from hypothesis or prediction_snapshot)
 * 2. Get actual KPIs (from metrics)
 * 3. Calculate prediction error
 * 4. Determine micro verdict
 * 5. Store in content_learnings
 */
import { getSettingNumber, getSharedPool } from '../../lib/settings';
import type { Pool } from 'pg';

interface MicroAnalysisResult {
  contentLearningId: string;
  contentId: string;
  predictionError: number;
  microVerdict: 'confirmed' | 'inconclusive' | 'rejected';
}

/**
 * Run per-content micro-analysis for a given content_id.
 * Should be called after metrics are collected (status = 'measured').
 */
export async function runPerContentMicroAnalysis(
  contentId: string,
): Promise<MicroAnalysisResult | null> {
  const pool: Pool = getSharedPool();

  // 1. Get content + hypothesis
  const contentRes = await pool.query(
    `SELECT c.content_id, c.hypothesis_id, h.predicted_kpis
     FROM content c
     LEFT JOIN hypotheses h ON h.id = c.hypothesis_id
     WHERE c.content_id = $1`,
    [contentId],
  );

  if (contentRes.rowCount === 0) {
    return null;
  }

  const content = contentRes.rows[0] as Record<string, unknown>;
  const hypothesisId = content['hypothesis_id'] as number | null;
  const predictedKpis = (content['predicted_kpis'] as Record<string, number>) ?? {};

  // 2. Get actual KPIs from metrics (averaged across publications)
  const metricsRes = await pool.query(
    `SELECT
       COALESCE(AVG(m.views), 0)::float AS views,
       COALESCE(AVG(m.likes), 0)::float AS likes,
       COALESCE(AVG(m.comments), 0)::float AS comments,
       COALESCE(AVG(m.shares), 0)::float AS shares,
       COALESCE(AVG(m.engagement_rate), 0)::float AS engagement_rate,
       COALESCE(AVG(m.completion_rate), 0)::float AS completion_rate
     FROM publications p
     JOIN metrics m ON m.publication_id = p.id
     WHERE p.content_id = $1`,
    [contentId],
  );

  const metricsRow = metricsRes.rows[0] as Record<string, unknown>;
  const actualKpis: Record<string, number> = {
    views: Number(metricsRow['views']),
    likes: Number(metricsRow['likes']),
    comments: Number(metricsRow['comments']),
    shares: Number(metricsRow['shares']),
    engagement_rate: Number(metricsRow['engagement_rate']),
    completion_rate: Number(metricsRow['completion_rate']),
  };

  // 3. Calculate prediction error (MAPE)
  let totalError = 0;
  let errorCount = 0;
  for (const key of Object.keys(predictedKpis)) {
    const predicted = predictedKpis[key];
    const actual = actualKpis[key];
    if (predicted !== undefined && actual !== undefined && actual !== 0) {
      totalError += Math.abs(predicted - actual) / Math.abs(actual);
      errorCount++;
    }
  }
  const predictionError = errorCount > 0 ? totalError / errorCount : 0;

  // 4. Determine micro verdict using thresholds from system_settings
  let confirmThreshold = 0.15;
  let rejectThreshold = 0.50;
  try {
    confirmThreshold = await getSettingNumber('MICRO_CONFIRM_THRESHOLD');
  } catch { /* use default */ }
  try {
    rejectThreshold = await getSettingNumber('MICRO_REJECT_THRESHOLD');
  } catch { /* use default */ }

  let microVerdict: 'confirmed' | 'inconclusive' | 'rejected';
  if (predictionError <= confirmThreshold) {
    microVerdict = 'confirmed';
  } else if (predictionError >= rejectThreshold) {
    microVerdict = 'rejected';
  } else {
    microVerdict = 'inconclusive';
  }

  // 5. Get niche from account
  const nicheRes = await pool.query(
    `SELECT a.niche
     FROM publications p
     JOIN accounts a ON a.account_id = p.account_id
     WHERE p.content_id = $1
     LIMIT 1`,
    [contentId],
  );
  const niche = nicheRes.rowCount && nicheRes.rowCount > 0
    ? (nicheRes.rows[0] as Record<string, unknown>)['niche'] as string | null
    : null;

  // 6. Store in content_learnings
  const insertRes = await pool.query(
    `INSERT INTO content_learnings
       (content_id, hypothesis_id, predicted_kpis, actual_kpis, prediction_error,
        micro_verdict, niche)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      contentId,
      hypothesisId,
      JSON.stringify(predictedKpis),
      JSON.stringify(actualKpis),
      predictionError,
      microVerdict,
      niche,
    ],
  );

  const contentLearningId = (insertRes.rows[0] as Record<string, unknown>)['id'] as string;

  return {
    contentLearningId,
    contentId,
    predictionError: Number(predictionError.toFixed(4)),
    microVerdict,
  };
}
