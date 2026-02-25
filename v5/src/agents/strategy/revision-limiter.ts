/**
 * FEAT-STR-005: MAX_STRATEGY_REVISIONS=3 loop limit
 * Spec: 04-agent-design.md §5.1, 02-architecture.md §3.3
 *
 * Limits the number of revision loops in the strategy cycle.
 * After MAX_STRATEGY_REVISIONS (default: 3) rejections, forces approval
 * to prevent infinite loops.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import { getSettingNumber } from '../../lib/settings.js';

/** Revision check result */
export interface RevisionCheckResult {
  revisionCount: number;
  maxRevisions: number;
  canRevise: boolean;
  forceApprove: boolean;
}

/**
 * Check if a revision is allowed based on current count vs max.
 *
 * @param currentCount - Number of revisions already done
 * @param maxRevisions - Maximum allowed revisions (from system_settings)
 */
export function checkRevisionLimit(
  currentCount: number,
  maxRevisions: number,
): RevisionCheckResult {
  const canRevise = currentCount < maxRevisions;
  return {
    revisionCount: currentCount,
    maxRevisions,
    canRevise,
    forceApprove: !canRevise,
  };
}

/**
 * Check revision limit using system_settings value.
 */
export async function checkRevisionLimitFromDb(
  client: PoolClient,
  currentCount: number,
): Promise<RevisionCheckResult> {
  const maxRevisions = await getSettingNumber('MAX_STRATEGY_REVISIONS', client);
  return checkRevisionLimit(currentCount, maxRevisions);
}

/**
 * Increment the revision count for content in a cycle.
 * Returns the new revision count.
 */
export async function incrementRevisionCount(
  client: PoolClient,
  contentId: string,
): Promise<number> {
  const res = await client.query(
    `UPDATE content
     SET revision_count = revision_count + 1, updated_at = NOW()
     WHERE content_id = $1
     RETURNING revision_count`,
    [contentId],
  );

  if (res.rows.length === 0) {
    throw new Error(`Content not found: ${contentId}`);
  }

  return (res.rows[0] as Record<string, unknown>)['revision_count'] as number;
}

/**
 * Force-approve all pending content in a cycle when revision limit is reached.
 */
export async function forceApproveCycleContent(
  client: PoolClient,
  cycleId: number,
): Promise<number> {
  const res = await client.query(
    `UPDATE content
     SET status = 'planned',
         approved_by = 'system_force_approve',
         approved_at = NOW(),
         approval_feedback = 'Force-approved after reaching MAX_STRATEGY_REVISIONS limit',
         updated_at = NOW()
     WHERE hypothesis_id IN (
       SELECT id FROM hypotheses WHERE cycle_id = $1
     )
     AND status IN ('pending_approval', 'rejected', 'revision_needed')`,
    [cycleId],
  );
  return res.rowCount ?? 0;
}
