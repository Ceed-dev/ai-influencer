/**
 * FEAT-MCC-004: set_cycle_plan
 * Spec: 04-agent-design.md §4.1 #8
 * Updates a cycle's summary (plan) JSONB field.
 */
import type {
  SetCyclePlanInput,
  SetCyclePlanOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpNotFoundError, McpValidationError } from '../../errors';

export async function setCyclePlan(
  input: SetCyclePlanInput,
): Promise<SetCyclePlanOutput> {
  if (input.cycle_id == null || typeof input.cycle_id !== 'number') {
    throw new McpValidationError(
      `Invalid cycle_id: "${String(input.cycle_id)}". Must be a number.`,
    );
  }

  if (input.summary == null || typeof input.summary !== 'object') {
    throw new McpValidationError(
      'Invalid summary: must be a non-null object.',
    );
  }

  const pool = getPool();

  const res = await pool.query(
    `UPDATE cycles SET summary = $2 WHERE id = $1 RETURNING id`,
    [input.cycle_id, JSON.stringify(input.summary)],
  );

  if (res.rowCount === 0) {
    throw new McpNotFoundError(
      `Cycle with id ${input.cycle_id} not found.`,
    );
  }

  return { success: true };
}
