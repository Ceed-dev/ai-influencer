/**
 * FEAT-MCC-024: get_component_data
 * Spec: 04-agent-design.md §4.6 #4
 * Retrieves component data (type, subtype, data, drive_file_id) from the components table.
 */
import type {
  GetComponentDataInput,
  GetComponentDataOutput,
} from '@/types/mcp-tools';
import type { ComponentType } from '@/types/database';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

export async function getComponentData(
  input: GetComponentDataInput,
): Promise<GetComponentDataOutput> {
  if (!input.component_id || input.component_id.trim() === '') {
    throw new McpValidationError('component_id is required and must be non-empty');
  }

  const pool = getPool();

  const res = await pool.query(
    `SELECT type, subtype, data, drive_file_id
     FROM components
     WHERE component_id = $1`,
    [input.component_id],
  );

  const row = res.rows[0] as {
    type: ComponentType;
    subtype: string | null;
    data: Record<string, unknown> | null;
    drive_file_id: string | null;
  } | undefined;

  if (!row) {
    throw new McpNotFoundError(`Component not found: ${input.component_id}`);
  }

  return {
    type: row.type,
    subtype: row.subtype ?? '',
    data: row.data ?? {},
    drive_file_id: row.drive_file_id,
  };
}
