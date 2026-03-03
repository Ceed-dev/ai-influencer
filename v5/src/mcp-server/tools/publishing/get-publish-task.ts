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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Atomically fetch and lock the next pending publish task
    const selectRes = await client.query<{
      id: number;
      payload: Record<string, unknown>;
      account_id: string;
      platform: Platform;
    }>(
      `SELECT tq.id, tq.payload, a.account_id, a.platform
       FROM task_queue tq
       JOIN accounts a ON a.account_id = (tq.payload->>'account_id')
       WHERE tq.task_type = 'publish'
         AND tq.status IN ('pending', 'queued')
       ORDER BY tq.priority DESC, tq.created_at ASC
       LIMIT 1
       FOR UPDATE OF tq SKIP LOCKED`,
    );

    const row = selectRes.rows[0];
    if (!row) {
      await client.query('COMMIT');
      return null;
    }

    // Mark the task as processing within the same transaction
    await client.query(
      `UPDATE task_queue SET status = 'processing', started_at = NOW() WHERE id = $1`,
      [row.id],
    );

    await client.query('COMMIT');

    const contentId = row.payload['content_id'];
    if (typeof contentId !== 'string') {
      throw new McpDbError('task_queue payload missing content_id');
    }

    return {
      task_id: row.id,
      content_id: contentId,
      account_id: row.account_id,
      platform: row.platform,
      payload: row.payload,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { /* ignore rollback errors */ });
    if (err instanceof McpDbError) throw err;
    throw new McpDbError('Failed to get publish task', err);
  } finally {
    client.release();
  }
}
