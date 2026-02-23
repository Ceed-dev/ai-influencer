/**
 * FEAT-MCC-025: get_publish_task
 * Spec: 04-mcp-tools.md SS2.7 #1
 * Returns the next pending publish task from the task queue,
 * or null if the queue is empty.
 */
import type {
  GetPublishTaskInput,
  GetPublishTaskOutput,
} from '@/types/mcp-tools';
import type { Platform } from '@/types/database';
import { getPool } from '../../db';
import { McpDbError } from '../../errors';

export async function getPublishTask(
  _input: GetPublishTaskInput,
): Promise<GetPublishTaskOutput | null> {
  const pool = getPool();

  try {
    // Fetch the highest-priority pending/queued publish task
    const selectRes = await pool.query<{
      id: number;
      payload: Record<string, unknown>;
      platform: Platform;
    }>(
      `SELECT tq.id, tq.payload, p.platform
       FROM task_queue tq
       JOIN publications p ON (tq.payload->>'content_id') = p.content_id
       WHERE tq.task_type = 'publish'
         AND tq.status IN ('pending', 'queued')
       ORDER BY tq.priority DESC, tq.created_at ASC
       LIMIT 1`,
    );

    const row = selectRes.rows[0];
    if (!row) {
      return null;
    }

    // Mark the task as processing
    await pool.query(
      `UPDATE task_queue SET status = 'processing', started_at = NOW() WHERE id = $1`,
      [row.id],
    );

    const contentId = row.payload['content_id'];
    if (typeof contentId !== 'string') {
      throw new McpDbError('task_queue payload missing content_id');
    }

    return {
      task_id: row.id,
      content_id: contentId,
      platform: row.platform,
      payload: row.payload,
    };
  } catch (err) {
    if (err instanceof McpDbError) {
      throw err;
    }
    throw new McpDbError('Failed to get publish task', err);
  }
}
