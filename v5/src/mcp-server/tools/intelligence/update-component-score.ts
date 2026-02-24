/**
 * MCI-038: update_component_score
 * Spec: 04-agent-design.md §4.3 #10
 *
 * Updates components.score for a given component_id.
 */
import type {
  UpdateComponentScoreInput,
  UpdateComponentScoreOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

export async function updateComponentScore(
  input: UpdateComponentScoreInput,
): Promise<UpdateComponentScoreOutput> {
  if (!input.component_id || input.component_id.trim().length === 0) {
    throw new McpValidationError('component_id is required');
  }
  if (typeof input.new_score !== 'number' || input.new_score < 0 || input.new_score > 100) {
    throw new McpValidationError('new_score must be a number between 0 and 100');
  }

  const pool = getPool();

  const res = await pool.query(
    `UPDATE components
     SET score = $1, updated_at = NOW()
     WHERE component_id = $2
     RETURNING component_id`,
    [input.new_score, input.component_id],
  );

  if (res.rowCount === 0) {
    throw new McpNotFoundError(`Component not found: ${input.component_id}`);
  }

  return { success: true };
}
