/**
 * FEAT-MS-006: リトライ間隔+最大試行回数
 * Spec: 03-database-schema.md §4.3 (task_queue retry_count, max_retries)
 *
 * METRICS_COLLECTION_RETRY_HOURS: retry interval (default: 6h)
 * METRICS_MAX_COLLECTION_ATTEMPTS: max retries before failed_permanent (default: 5)
 *
 * On API failure:
 * - If retry_count < max_retries: set status='retrying', schedule next attempt
 * - If retry_count >= max_retries: set status='failed_permanent'
 */
import type { PoolClient } from 'pg';
import { getSettingNumber } from '../../lib/settings.js';

/**
 * Handle a measurement task failure.
 * Increments retry_count and either schedules a retry or marks as failed_permanent.
 *
 * Returns the new status of the task.
 */
export async function handleMeasurementFailure(
  client: PoolClient,
  taskId: number,
  errorMessage: string,
): Promise<{ status: 'retrying' | 'failed_permanent'; retryCount: number }> {
  const retryHours = await getSettingNumber('METRICS_COLLECTION_RETRY_HOURS', client);
  const maxAttempts = await getSettingNumber('METRICS_MAX_COLLECTION_ATTEMPTS', client);

  // Get current retry count and max_retries
  const taskRes = await client.query(
    'SELECT retry_count, max_retries FROM task_queue WHERE id = $1',
    [taskId],
  );

  if (taskRes.rows.length === 0) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const currentRetryCount = taskRes.rows[0].retry_count;
  const taskMaxRetries = taskRes.rows[0].max_retries ?? maxAttempts;
  const newRetryCount = currentRetryCount + 1;

  if (newRetryCount >= taskMaxRetries) {
    // Max retries exceeded → failed_permanent
    await client.query(`
      UPDATE task_queue
      SET status = 'failed_permanent',
          retry_count = $1,
          error_message = $2,
          last_error_at = NOW(),
          completed_at = NOW()
      WHERE id = $3
    `, [newRetryCount, errorMessage, taskId]);

    return { status: 'failed_permanent', retryCount: newRetryCount };
  }

  // Schedule retry: update status to 'retrying' and set next attempt time
  // The next poll cycle will pick up 'retrying' tasks after the retry interval
  await client.query(`
    UPDATE task_queue
    SET status = 'retrying',
        retry_count = $1,
        error_message = $2,
        last_error_at = NOW(),
        started_at = NOW() + make_interval(hours => $3)
    WHERE id = $4
  `, [newRetryCount, errorMessage, retryHours, taskId]);

  return { status: 'retrying', retryCount: newRetryCount };
}

/**
 * Check if a task should be retried based on its started_at (scheduled retry time).
 * Returns true if the task is eligible for retry (started_at <= NOW() or started_at is NULL).
 */
export async function isRetryEligible(
  client: PoolClient,
  taskId: number,
): Promise<boolean> {
  const res = await client.query(`
    SELECT 1 FROM task_queue
    WHERE id = $1
      AND status = 'retrying'
      AND (started_at IS NULL OR started_at <= NOW())
  `, [taskId]);
  return res.rows.length > 0;
}
