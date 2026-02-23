/**
 * FEAT-VW-001: Task queue polling — empty queue + task acquisition
 * FEAT-VW-012: task_queue priority sort
 * FEAT-VW-010: Concurrency limit
 * FEAT-VW-011: failed_permanent skip
 * FEAT-VW-018: Dynamic system_settings reload
 * Spec: 04-agent-design.md §5.2
 */
import { getPool } from '../../db/pool.js';
import { getSettingNumber } from '../../lib/settings.js';
import type { TaskQueueRow } from '../../../types/database.js';

export async function acquireNextTask(workerId: string): Promise<TaskQueueRow | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<TaskQueueRow>(
      `SELECT * FROM task_queue
       WHERE task_type = 'produce'
         AND status = 'pending'
       ORDER BY priority DESC, created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
    );
    if (result.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }
    const task = result.rows[0]!;
    await client.query(
      `UPDATE task_queue SET status = 'processing', assigned_worker = $1, started_at = NOW() WHERE id = $2`,
      [workerId, task.id],
    );
    await client.query('COMMIT');
    return { ...task, status: 'processing', assigned_worker: workerId, started_at: new Date().toISOString() };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getActiveTaskCount(): Promise<number> {
  const pool = getPool();
  const res = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM task_queue WHERE task_type = 'produce' AND status = 'processing'`,
  );
  return parseInt(res.rows[0]!.count, 10);
}

export async function loadPollerSettings(): Promise<{ pollIntervalMs: number; maxConcurrent: number }> {
  const [pollSec, maxConc] = await Promise.all([
    getSettingNumber('PRODUCTION_POLL_INTERVAL_SEC').catch(() => 30),
    getSettingNumber('MAX_CONCURRENT_PRODUCTIONS').catch(() => 5),
  ]);
  return { pollIntervalMs: pollSec * 1000, maxConcurrent: maxConc };
}

export async function pollOnce(workerId: string): Promise<{ type: 'no_task' | 'at_capacity' | 'task_acquired'; task?: TaskQueueRow }> {
  const settings = await loadPollerSettings();
  const activeCount = await getActiveTaskCount();
  if (activeCount >= settings.maxConcurrent) return { type: 'at_capacity' };
  const task = await acquireNextTask(workerId);
  if (!task) return { type: 'no_task' };
  return { type: 'task_acquired', task };
}

export async function completeTask(taskId: number): Promise<void> {
  const pool = getPool();
  await pool.query(`UPDATE task_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`, [taskId]);
}

export async function failTask(taskId: number, errorMessage: string, permanent: boolean = false): Promise<void> {
  const pool = getPool();
  if (permanent) {
    await pool.query(
      `UPDATE task_queue SET status = 'failed_permanent', error_message = $2, last_error_at = NOW() WHERE id = $1`,
      [taskId, errorMessage],
    );
  } else {
    await pool.query(
      `UPDATE task_queue SET
         status = CASE WHEN retry_count + 1 >= max_retries THEN 'failed_permanent' ELSE 'pending' END,
         retry_count = retry_count + 1,
         error_message = $2,
         last_error_at = NOW(),
         assigned_worker = NULL,
         started_at = NULL
       WHERE id = $1`,
      [taskId, errorMessage],
    );
  }
}
