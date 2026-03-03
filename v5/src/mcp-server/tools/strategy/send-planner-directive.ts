/**
 * FEAT-MCC-006: send_planner_directive + get_pending_directives
 * Spec: 04-agent-design.md §4.1 #10, #6
 * send_planner_directive: Inserts a planner directive for a given cluster.
 * get_pending_directives: Retrieves all pending human directives, ordered by priority.
 */
import type {
  SendPlannerDirectiveInput,
  SendPlannerDirectiveOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpDbError, McpValidationError } from '../../errors';

export async function sendPlannerDirective(
  input: SendPlannerDirectiveInput,
): Promise<SendPlannerDirectiveOutput> {
  if (!input.cluster || typeof input.cluster !== 'string') {
    throw new McpValidationError(
      'Invalid cluster: must be a non-empty string.',
    );
  }

  if (!input.directive_text || typeof input.directive_text !== 'string') {
    throw new McpValidationError(
      'Invalid directive_text: must be a non-empty string.',
    );
  }

  const pool = getPool();

  try {
    await pool.query(
      `INSERT INTO human_directives (directive_type, content, target_niches, status, priority)
       VALUES ('instruction', $1, ARRAY[$2]::varchar[], 'pending', 'normal')`,
      [input.directive_text, input.cluster],
    );

    return { success: true };
  } catch (err: unknown) {
    if (err instanceof McpValidationError) {
      throw err;
    }
    throw new McpDbError('Failed to send planner directive', err);
  }
}

