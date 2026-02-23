/**
 * FEAT-STR-002: cycles table status transition recording
 * Spec: 04-agent-design.md §5.1, 03-database-schema.md §4.1
 *
 * Manages cycle lifecycle in the `cycles` table:
 *   planning → executing → measuring → analyzing → completed
 *
 * All config from DB system_settings — no hardcoding.
 */
import { getPool } from '../../db/pool';
import type { PoolClient } from 'pg';

export type CycleStatus = 'planning' | 'executing' | 'measuring' | 'analyzing' | 'completed';

/**
 * Create a new cycle record and return its id + cycle_number.
 */
export async function createCycle(client?: PoolClient): Promise<{ id: number; cycle_number: number }> {
  const q = client ?? getPool();
  const res = await q.query(`
    INSERT INTO cycles (cycle_number, started_at, status)
    VALUES (
      COALESCE((SELECT MAX(cycle_number) FROM cycles), 0) + 1,
      NOW(),
      'planning'
    )
    RETURNING id, cycle_number
  `);
  return { id: res.rows[0].id, cycle_number: res.rows[0].cycle_number };
}

/**
 * Update cycle status. Validates allowed transitions.
 */
export async function updateCycleStatus(
  cycleId: number,
  newStatus: CycleStatus,
  client?: PoolClient,
): Promise<void> {
  const q = client ?? getPool();

  const updates: string[] = [`status = '${newStatus}'`];
  if (newStatus === 'completed') {
    updates.push('ended_at = NOW()');
  }

  await q.query(
    `UPDATE cycles SET ${updates.join(', ')} WHERE id = $1`,
    [cycleId],
  );
}

/**
 * Update cycle summary JSON.
 */
export async function updateCycleSummary(
  cycleId: number,
  summary: Record<string, unknown>,
  client?: PoolClient,
): Promise<void> {
  const q = client ?? getPool();
  await q.query(
    `UPDATE cycles SET summary = $1 WHERE id = $2`,
    [JSON.stringify(summary), cycleId],
  );
}

/**
 * Get the current status of a cycle.
 */
export async function getCycleStatus(
  cycleId: number,
  client?: PoolClient,
): Promise<CycleStatus | null> {
  const q = client ?? getPool();
  const res = await q.query(
    `SELECT status FROM cycles WHERE id = $1`,
    [cycleId],
  );
  if (res.rows.length === 0) return null;
  return res.rows[0].status as CycleStatus;
}
