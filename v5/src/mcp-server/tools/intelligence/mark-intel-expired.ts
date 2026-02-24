/**
 * FEAT-MCI-005: mark_intel_expired
 * Spec: 04-agent-design.md §4.2 #11
 */
import type {
  MarkIntelExpiredInput,
  MarkIntelExpiredOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

export async function markIntelExpired(
  input: MarkIntelExpiredInput,
): Promise<MarkIntelExpiredOutput> {
  if (typeof input.intel_id !== 'number' || input.intel_id <= 0) {
    throw new McpValidationError('intel_id must be a positive integer');
  }

  const pool = getPool();

  const res = await pool.query(
    `UPDATE market_intel
     SET expires_at = NOW()
     WHERE id = $1
       AND (expires_at IS NULL OR expires_at > NOW())
     RETURNING id`,
    [input.intel_id],
  );

  if (res.rowCount === 0) {
    throw new McpNotFoundError(
      `market_intel with id=${input.intel_id} not found or already expired`,
    );
  }

  return { success: true };
}
