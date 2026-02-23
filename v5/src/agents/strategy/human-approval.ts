/**
 * FEAT-STR-003: STRATEGY_APPROVAL_REQUIRED flow
 * Spec: 04-agent-design.md §5.1, 02-architecture.md §3.3
 *
 * Checks STRATEGY_APPROVAL_REQUIRED setting from system_settings.
 * When true, content plans require human approval before proceeding.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import { getSettingBoolean } from '../../lib/settings.js';

/** Approval flow check result */
export interface ApprovalFlowResult {
  requiresApproval: boolean;
  settingKey: string;
}

/**
 * Check if human approval is required for strategy cycle plans.
 * Reads STRATEGY_APPROVAL_REQUIRED from system_settings.
 */
export async function isApprovalRequired(
  client?: PoolClient,
): Promise<boolean> {
  return getSettingBoolean('STRATEGY_APPROVAL_REQUIRED', client);
}

/**
 * Set content status to 'pending_approval' for all planned content in a cycle.
 */
export async function markContentPendingApproval(
  client: PoolClient,
  cycleId: number,
): Promise<number> {
  const res = await client.query(
    `UPDATE content
     SET status = 'pending_approval', updated_at = NOW()
     WHERE hypothesis_id IN (
       SELECT id FROM hypotheses WHERE cycle_id = $1
     )
     AND status = 'planned'`,
    [cycleId],
  );
  return res.rowCount ?? 0;
}

/**
 * Process human approval result for cycle content.
 * On approval: transitions content from 'pending_approval' to 'planned'
 * On rejection: transitions based on rejection_category
 */
export async function processApprovalResult(
  client: PoolClient,
  cycleId: number,
  approved: boolean,
  feedback?: string,
  rejectionCategory?: string,
): Promise<{ updatedCount: number; newStatus: string }> {
  if (approved) {
    const res = await client.query(
      `UPDATE content
       SET status = 'planned',
           approved_by = 'human',
           approved_at = NOW(),
           approval_feedback = $1,
           updated_at = NOW()
       WHERE hypothesis_id IN (
         SELECT id FROM hypotheses WHERE cycle_id = $2
       )
       AND status = 'pending_approval'`,
      [feedback ?? null, cycleId],
    );
    return { updatedCount: res.rowCount ?? 0, newStatus: 'planned' };
  }

  // Rejection
  const res = await client.query(
    `UPDATE content
     SET status = 'rejected',
         approval_feedback = $1,
         rejection_category = $2,
         updated_at = NOW()
     WHERE hypothesis_id IN (
       SELECT id FROM hypotheses WHERE cycle_id = $3
     )
     AND status = 'pending_approval'`,
    [feedback ?? null, rejectionCategory ?? 'plan_revision', cycleId],
  );
  return { updatedCount: res.rowCount ?? 0, newStatus: 'rejected' };
}
