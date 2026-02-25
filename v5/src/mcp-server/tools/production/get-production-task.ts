/**
 * FEAT-MCC-013: get_production_task
 * Spec: 04-agent-design.md SS4.6 #1
 * Fetches the next production task from the queue and marks it as processing.
 * Returns null if no pending/queued tasks exist.
 */
import type {
  GetProductionTaskInput,
  GetProductionTaskOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpDbError } from '../../errors';

export async function getProductionTask(
  _input: GetProductionTaskInput,
): Promise<GetProductionTaskOutput | null> {
  const pool = getPool();

  // Fetch the highest-priority pending/queued production task
  const selectRes = await pool.query(
    `SELECT id, payload
     FROM task_queue
     WHERE task_type = 'produce'
       AND status IN ('pending', 'queued')
     ORDER BY priority DESC, created_at ASC
     LIMIT 1`,
  );

  const row = selectRes.rows[0] as { id: number; payload: Record<string, unknown> } | undefined;
  if (!row) {
    return null;
  }

  // Mark the task as processing
  const updateRes = await pool.query(
    `UPDATE task_queue
     SET status = 'processing', started_at = NOW()
     WHERE id = $1`,
    [row.id],
  );

  if (updateRes.rowCount === 0) {
    throw new McpDbError(`Failed to update task_queue row id=${row.id} to processing`);
  }

  const contentId = row.payload['content_id'];
  if (typeof contentId !== 'string') {
    throw new McpDbError(`task_queue row id=${row.id} payload is missing content_id`);
  }

  return {
    task_id: row.id,
    content_id: contentId,
    payload: row.payload,
  };
}
