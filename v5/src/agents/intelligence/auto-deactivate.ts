/**
 * FEAT-INT-006: Auto-deactivate learnings below confidence threshold
 * Spec: 04-agent-design.md §4.12, 02-architecture.md §7
 *
 * Sets is_active=false when confidence < LEARNING_DEACTIVATION_THRESHOLD.
 * Runs periodically to prune low-confidence learnings from active use.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import { getSettingNumber } from '../../lib/settings.js';

/** Result of auto-deactivation scan */
export interface DeactivationResult {
  deactivatedCount: number;
  threshold: number;
  deactivatedIds: string[];
}

/**
 * Check if a single learning should be deactivated.
 */
export function shouldDeactivate(confidence: number, threshold: number): boolean {
  return confidence < threshold;
}

/**
 * Deactivate all agent_individual_learnings where confidence < threshold.
 *
 * @param client - Database client (for transaction support)
 * @param agentType - Optional: limit to a specific agent type
 * @returns Number of deactivated learnings and their IDs
 */
export async function autoDeactivateLearnings(
  client: PoolClient,
  agentType?: string,
): Promise<DeactivationResult> {
  const threshold = await getSettingNumber('LEARNING_DEACTIVATION_THRESHOLD', client);

  let sql: string;
  let params: unknown[];

  if (agentType) {
    sql = `
      UPDATE agent_individual_learnings
      SET is_active = false, updated_at = NOW()
      WHERE is_active = true
        AND confidence < $1
        AND agent_type = $2
      RETURNING id
    `;
    params = [threshold, agentType];
  } else {
    sql = `
      UPDATE agent_individual_learnings
      SET is_active = false, updated_at = NOW()
      WHERE is_active = true
        AND confidence < $1
      RETURNING id
    `;
    params = [threshold];
  }

  const res = await client.query(sql, params);
  const deactivatedIds = res.rows.map((r: Record<string, unknown>) => r['id'] as string);

  return {
    deactivatedCount: deactivatedIds.length,
    threshold,
    deactivatedIds,
  };
}
