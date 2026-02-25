/**
 * MCI-018: update_component_data
 * Spec: 04-agent-design.md S4.10 #3
 * Updates an existing component's data and optionally tags.
 */
import type {
  UpdateComponentDataInput,
  UpdateComponentDataOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

export async function updateComponentData(
  input: UpdateComponentDataInput,
): Promise<UpdateComponentDataOutput> {
  if (!input.component_id || input.component_id.trim().length === 0) {
    throw new McpValidationError('component_id is required');
  }
  if (!input.data || typeof input.data !== 'object') {
    throw new McpValidationError('data must be a non-empty object');
  }

  const pool = getPool();

  // Check component exists
  const existing = await pool.query(
    `SELECT id FROM components WHERE component_id = $1`,
    [input.component_id],
  );
  if (existing.rowCount === 0) {
    throw new McpNotFoundError(`Component "${input.component_id}" not found`);
  }

  if (input.tags !== undefined) {
    await pool.query(
      `UPDATE components SET data = $1, tags = $2 WHERE component_id = $3`,
      [JSON.stringify(input.data), input.tags, input.component_id],
    );
  } else {
    await pool.query(
      `UPDATE components SET data = $1 WHERE component_id = $2`,
      [JSON.stringify(input.data), input.component_id],
    );
  }

  return { success: true };
}
