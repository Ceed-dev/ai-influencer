/**
 * FEAT-MCC-009: schedule_content
 * Spec: 04-agent-design.md S4.4 #6
 * Sets planned_post_date for a content item.
 */
import type {
  ScheduleContentInput,
  ScheduleContentOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpNotFoundError, McpDbError } from '../../errors';

export async function scheduleContent(
  input: ScheduleContentInput,
): Promise<ScheduleContentOutput> {
  const pool = getPool();

  try {
    const res = await pool.query(
      `
      UPDATE content
      SET planned_post_date = $2, updated_at = NOW()
      WHERE content_id = $1
      `,
      [input.content_id, input.planned_post_date],
    );

    if (res.rowCount === 0) {
      throw new McpNotFoundError(
        `Content not found: "${input.content_id}"`,
      );
    }

    return { success: true };
  } catch (err) {
    if (err instanceof McpNotFoundError) throw err;
    throw new McpDbError('Failed to schedule content', err);
  }
}
