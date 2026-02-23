/**
 * FEAT-MCC-027: report_publish_result
 * Spec: 04-mcp-tools.md SS2.7 #6
 * Records the result of a successful platform publish:
 *  - Marks the task_queue row as completed
 *  - Updates the publications row with post details
 */
import type {
  ReportPublishResultInput,
  ReportPublishResultOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpDbError } from '../../errors';

export async function reportPublishResult(
  input: ReportPublishResultInput,
): Promise<ReportPublishResultOutput> {
  if (!Number.isInteger(input.task_id) || input.task_id <= 0) {
    throw new McpValidationError('task_id must be a positive integer');
  }
  if (!input.content_id || input.content_id.trim() === '') {
    throw new McpValidationError('content_id is required');
  }
  if (!input.platform_post_id || input.platform_post_id.trim() === '') {
    throw new McpValidationError('platform_post_id is required');
  }
  if (!input.post_url || input.post_url.trim() === '') {
    throw new McpValidationError('post_url is required');
  }
  if (!input.posted_at || input.posted_at.trim() === '') {
    throw new McpValidationError('posted_at is required');
  }

  const pool = getPool();

  try {
    // Mark the task as completed
    await pool.query(
      `UPDATE task_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [input.task_id],
    );

    // Update the publication record with post details
    await pool.query(
      `UPDATE publications
         SET platform_post_id = $2,
             post_url = $3,
             posted_at = $4,
             status = 'posted'
       WHERE content_id = $1
         AND platform_post_id IS NULL`,
      [
        input.content_id,
        input.platform_post_id,
        input.post_url,
        input.posted_at,
      ],
    );

    return { success: true };
  } catch (err) {
    throw new McpDbError('Failed to report publish result', err);
  }
}
