/**
 * FEAT-MCC-021: report_production_complete
 * Spec: 04-agent-design.md SS4.6 #12
 * Marks a production task as completed and updates the content record
 * with the final video Drive ID and ready_to_publish status.
 */
import type {
  ReportProductionCompleteInput,
  ReportProductionCompleteOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpDbError } from '../../errors';

export async function reportProductionComplete(
  input: ReportProductionCompleteInput,
): Promise<ReportProductionCompleteOutput> {
  const pool = getPool();

  // Mark the task as completed
  const taskRes = await pool.query(
    `UPDATE task_queue
     SET status = 'completed', completed_at = NOW()
     WHERE id = $1`,
    [input.task_id],
  );

  if (taskRes.rowCount === 0) {
    throw new McpDbError(`Task not found or already completed: task_id=${input.task_id}`);
  }

  // Update content with video info and set ready_to_publish
  const contentRes = await pool.query(
    `UPDATE content
     SET video_drive_id = $2,
         status = 'ready',
         updated_at = NOW()
     WHERE content_id = $1`,
    [input.content_id, input.video_drive_id],
  );

  if (contentRes.rowCount === 0) {
    throw new McpDbError(`Content not found: content_id=${input.content_id}`);
  }

  return { success: true };
}
