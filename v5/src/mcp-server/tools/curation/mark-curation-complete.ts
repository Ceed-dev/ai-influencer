/**
 * MCI-019: mark_curation_complete
 * Spec: 04-agent-design.md S4.10 #4
 * Marks a curation task as complete with result component IDs.
 */
import type {
  MarkCurationCompleteInput,
  MarkCurationCompleteOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

export async function markCurationComplete(
  input: MarkCurationCompleteInput,
): Promise<MarkCurationCompleteOutput> {
  if (typeof input.queue_id !== 'number' || input.queue_id < 1) {
    throw new McpValidationError('queue_id must be a positive integer');
  }
  if (!Array.isArray(input.result_component_ids)) {
    throw new McpValidationError('result_component_ids must be an array');
  }

  const pool = getPool();

  // task_queue is used as the curation queue
  const existing = await pool.query(
    `SELECT id FROM task_queue WHERE id = $1 AND task_type = 'curate'`,
    [input.queue_id],
  );
  if (existing.rowCount === 0) {
    throw new McpNotFoundError(`Curation task with queue_id=${input.queue_id} not found`);
  }

  await pool.query(
    `UPDATE task_queue
     SET status = 'completed',
         completed_at = NOW(),
         payload = payload || $1
     WHERE id = $2`,
    [
      JSON.stringify({ result_component_ids: input.result_component_ids }),
      input.queue_id,
    ],
  );

  return { success: true };
}
