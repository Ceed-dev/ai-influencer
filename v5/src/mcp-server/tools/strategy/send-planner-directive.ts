/**
 * FEAT-MCC-006: send_planner_directive + get_pending_directives
 * Spec: 04-agent-design.md §4.1 #10, #6
 * send_planner_directive: Inserts a planner directive for a given cluster.
 * get_pending_directives: Retrieves all pending human directives, ordered by priority.
 */
import type {
  SendPlannerDirectiveInput,
  SendPlannerDirectiveOutput,
  GetPendingDirectivesInput,
  GetPendingDirectivesOutput,
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

export async function getPendingDirectives(
  _input: GetPendingDirectivesInput,
): Promise<GetPendingDirectivesOutput> {
  const pool = getPool();

  const res = await pool.query(`
    SELECT
      id,
      directive_type,
      content,
      priority,
      created_at
    FROM human_directives
    WHERE status = 'pending'
    ORDER BY
      CASE priority
        WHEN 'urgent' THEN 4
        WHEN 'high' THEN 3
        WHEN 'normal' THEN 2
        ELSE 1
      END DESC,
      created_at ASC
  `);

  const PRIORITY_MAP: Record<string, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };

  const directives = res.rows.map((row: Record<string, unknown>) => ({
    id: Number(row['id']),
    directive_type: String(row['directive_type'] ?? ''),
    content: String(row['content'] ?? ''),
    priority: PRIORITY_MAP[String(row['priority'] ?? 'normal')] ?? 2,
    created_at: String(row['created_at'] ?? ''),
  }));

  return { directives };
}
