/**
 * FEAT-INT-005: Confidence updater for agent_individual_learnings
 * Spec: 04-agent-design.md §4.12, 02-architecture.md §7
 *
 * Updates agent_individual_learnings.confidence on success/failure.
 * Confidence grows on successful application, decays on failure.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';

/** Adjustment parameters for confidence update */
export interface ConfidenceAdjustment {
  learningId: string;
  success: boolean;
}

/** Result of a confidence update operation */
export interface ConfidenceUpdateResult {
  learningId: string;
  previousConfidence: number;
  newConfidence: number;
  timesApplied: number;
  timesSuccessful: number;
}

/**
 * Calculate new confidence based on success/failure.
 *
 * On success: confidence += (1 - confidence) * CONFIDENCE_GROWTH_RATE
 * On failure: confidence -= confidence * CONFIDENCE_DECAY_RATE
 * Clamped to [0.0, 1.0]
 *
 * @param currentConfidence - Current confidence value (0.0-1.0)
 * @param success - Whether the application was successful
 * @param growthRate - Rate of confidence increase (default: 0.1)
 * @param decayRate - Rate of confidence decrease (default: 0.15)
 */
export function calculateNewConfidence(
  currentConfidence: number,
  success: boolean,
  growthRate: number = 0.1,
  decayRate: number = 0.15,
): number {
  let newConfidence: number;
  if (success) {
    newConfidence = currentConfidence + (1 - currentConfidence) * growthRate;
  } else {
    newConfidence = currentConfidence - currentConfidence * decayRate;
  }
  return Math.max(0, Math.min(1, newConfidence));
}

/**
 * Update confidence for a learning after it has been applied.
 * Also increments times_applied and conditionally times_successful.
 */
export async function updateLearningConfidence(
  client: PoolClient,
  adjustment: ConfidenceAdjustment,
  growthRate: number = 0.1,
  decayRate: number = 0.15,
): Promise<ConfidenceUpdateResult> {
  // Get current state
  const res = await client.query(
    `SELECT confidence, times_applied, times_successful
     FROM agent_individual_learnings WHERE id = $1`,
    [adjustment.learningId],
  );

  if (res.rows.length === 0) {
    throw new Error(`Learning not found: ${adjustment.learningId}`);
  }

  const row = res.rows[0] as Record<string, unknown>;
  const previousConfidence = Number(row['confidence']);
  const timesApplied = (Number(row['times_applied']) || 0) + 1;
  const timesSuccessful = (Number(row['times_successful']) || 0) + (adjustment.success ? 1 : 0);

  const newConfidence = calculateNewConfidence(
    previousConfidence,
    adjustment.success,
    growthRate,
    decayRate,
  );

  await client.query(
    `UPDATE agent_individual_learnings
     SET confidence = $1,
         times_applied = $2,
         times_successful = $3,
         last_applied_at = NOW(),
         updated_at = NOW()
     WHERE id = $4`,
    [newConfidence, timesApplied, timesSuccessful, adjustment.learningId],
  );

  return {
    learningId: adjustment.learningId,
    previousConfidence,
    newConfidence,
    timesApplied,
    timesSuccessful,
  };
}
