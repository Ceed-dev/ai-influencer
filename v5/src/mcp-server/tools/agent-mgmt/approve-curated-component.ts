/**
 * FEAT-MCC-040: approve_curated_component
 * Spec: 04-agent-design.md §4.11 #2
 * Updates component review_status to 'human_approved' and optionally applies modifications.
 */
import type {
  ApproveCuratedComponentInput,
  ApproveCuratedComponentOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError, McpDbError } from '../../errors';

export async function approveCuratedComponent(
  input: ApproveCuratedComponentInput,
): Promise<ApproveCuratedComponentOutput> {
  if (!input.component_id || input.component_id.trim() === '') {
    throw new McpValidationError('component_id is required and must be non-empty');
  }

  const pool = getPool();

  // Verify component exists
  const checkRes = await pool.query(
    `SELECT component_id, data FROM components WHERE component_id = $1`,
    [input.component_id],
  );

  const componentRow = checkRes.rows[0] as { component_id: string; data: Record<string, unknown> | null } | undefined;
  if (!componentRow) {
    throw new McpNotFoundError(`Component not found: ${input.component_id}`);
  }

  // Apply modifications if provided, otherwise just approve
  if (input.modifications && Object.keys(input.modifications).length > 0) {
    const mergedData = { ...(componentRow.data ?? {}), ...input.modifications };
    const updateRes = await pool.query(
      `UPDATE components
       SET review_status = 'human_approved', data = $2, updated_at = NOW()
       WHERE component_id = $1`,
      [input.component_id, JSON.stringify(mergedData)],
    );
    if (updateRes.rowCount === 0) {
      throw new McpDbError(`Failed to approve component: ${input.component_id}`);
    }
  } else {
    const updateRes = await pool.query(
      `UPDATE components
       SET review_status = 'human_approved', updated_at = NOW()
       WHERE component_id = $1`,
      [input.component_id],
    );
    if (updateRes.rowCount === 0) {
      throw new McpDbError(`Failed to approve component: ${input.component_id}`);
    }
  }

  return { success: true };
}
