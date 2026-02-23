/**
 * FEAT-INT-009: Hypothesis verifier
 * Spec: 04-agent-design.md §4.3 (#2, #3), 02-architecture.md §7
 *
 * Compares predicted vs actual KPIs for hypotheses.
 * Sets verdict to confirmed/rejected/inconclusive based on deviation threshold.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import type { HypothesisVerdict, HypothesisKpis } from '@/types/database';

/** Result of hypothesis verification */
export interface VerificationResult {
  hypothesisId: number;
  verdict: HypothesisVerdict;
  deviationPct: number;
  predictedKpis: Record<string, number>;
  actualKpis: Record<string, number>;
  explanation: string;
}

/**
 * Calculate deviation percentage between predicted and actual KPIs.
 * Uses Mean Absolute Percentage Error (MAPE) across all shared KPI keys.
 */
export function calculateDeviation(
  predicted: Record<string, number>,
  actual: Record<string, number>,
): number {
  const keys = Object.keys(predicted).filter(
    (k) => actual[k] !== undefined && actual[k] !== 0,
  );
  if (keys.length === 0) return 1.0; // 100% deviation if no comparable keys

  let totalDeviation = 0;
  for (const key of keys) {
    const pred = predicted[key]!;
    const act = actual[key]!;
    totalDeviation += Math.abs(pred - act) / Math.abs(act);
  }

  return totalDeviation / keys.length;
}

/**
 * Determine verdict based on deviation percentage.
 *
 * @param deviationPct - MAPE deviation (0.0-inf)
 * @param confirmThreshold - Max deviation for "confirmed" (default: 0.2 = 20%)
 * @param rejectThreshold - Min deviation for "rejected" (default: 0.5 = 50%)
 */
export function determineVerdict(
  deviationPct: number,
  confirmThreshold: number = 0.2,
  rejectThreshold: number = 0.5,
): HypothesisVerdict {
  if (deviationPct <= confirmThreshold) return 'confirmed';
  if (deviationPct >= rejectThreshold) return 'rejected';
  return 'inconclusive';
}

/**
 * Verify a hypothesis by comparing predicted vs actual KPIs.
 *
 * Retrieves content metrics linked to the hypothesis,
 * aggregates actual KPIs, and compares against predicted KPIs.
 */
export async function verifyHypothesis(
  client: PoolClient,
  hypothesisId: number,
  confirmThreshold: number = 0.2,
  rejectThreshold: number = 0.5,
): Promise<VerificationResult> {
  // Get hypothesis predicted KPIs
  const hypRes = await client.query(
    `SELECT predicted_kpis FROM hypotheses WHERE id = $1`,
    [hypothesisId],
  );

  if (hypRes.rows.length === 0) {
    throw new Error(`Hypothesis not found: ${hypothesisId}`);
  }

  const predictedKpis = (hypRes.rows[0] as Record<string, unknown>)['predicted_kpis'] as Record<string, number> | null;
  if (!predictedKpis || Object.keys(predictedKpis).length === 0) {
    return {
      hypothesisId,
      verdict: 'inconclusive',
      deviationPct: 1.0,
      predictedKpis: predictedKpis ?? {},
      actualKpis: {},
      explanation: 'No predicted KPIs available for comparison',
    };
  }

  // Get actual metrics for content linked to this hypothesis
  const metricsRes = await client.query(
    `SELECT AVG(m.views) AS avg_views,
            AVG(m.engagement_rate) AS avg_engagement_rate,
            AVG(m.completion_rate) AS avg_completion_rate,
            SUM(m.follower_delta) AS total_follower_delta,
            COUNT(*) AS evidence_count
     FROM metrics m
     JOIN publications pub ON m.publication_id = pub.id
     JOIN content c ON pub.content_id = c.content_id
     WHERE c.hypothesis_id = $1
       AND m.measurement_point = '48h'`,
    [hypothesisId],
  );

  const row = metricsRes.rows[0] as Record<string, unknown> | undefined;
  const evidenceCount = Number(row?.['evidence_count'] ?? 0);

  if (evidenceCount === 0) {
    return {
      hypothesisId,
      verdict: 'pending',
      deviationPct: 1.0,
      predictedKpis,
      actualKpis: {},
      explanation: 'No measurement data available yet',
    };
  }

  const actualKpis: Record<string, number> = {};
  if (row?.['avg_views'] != null) actualKpis['views'] = Number(row['avg_views']);
  if (row?.['avg_engagement_rate'] != null) actualKpis['engagement_rate'] = Number(row['avg_engagement_rate']);
  if (row?.['avg_completion_rate'] != null) actualKpis['completion_rate'] = Number(row['avg_completion_rate']);
  if (row?.['total_follower_delta'] != null) actualKpis['follower_delta'] = Number(row['total_follower_delta']);

  const deviationPct = calculateDeviation(predictedKpis, actualKpis);
  const verdict = determineVerdict(deviationPct, confirmThreshold, rejectThreshold);

  // Update hypothesis in DB
  await client.query(
    `UPDATE hypotheses
     SET verdict = $1, actual_kpis = $2, confidence = $3, evidence_count = $4, updated_at = NOW()
     WHERE id = $5`,
    [
      verdict,
      JSON.stringify(actualKpis),
      Math.max(0, 1 - deviationPct),
      evidenceCount,
      hypothesisId,
    ],
  );

  return {
    hypothesisId,
    verdict,
    deviationPct,
    predictedKpis,
    actualKpis,
    explanation: `Deviation ${(deviationPct * 100).toFixed(1)}% across ${Object.keys(actualKpis).length} KPIs from ${evidenceCount} measurements`,
  };
}
