/**
 * FEAT-MCC-028: get_measurement_tasks
 * Spec: 04-agent-design.md §4.8 #1
 * Retrieves pending/queued measurement tasks from task_queue.
 */
import type {
  GetMeasurementTasksInput,
  GetMeasurementTasksOutput,
} from '@/types/mcp-tools';
import type { Platform } from '@/types/database';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function getMeasurementTasks(
  input: GetMeasurementTasksInput,
): Promise<GetMeasurementTasksOutput> {
  const limit = input.limit;
  if (typeof limit !== 'number' || limit < 1 || limit > 100) {
    throw new McpValidationError('limit must be a number between 1 and 100');
  }

  const pool = getPool();

  const res = await pool.query(
    `SELECT tq.id AS task_id,
            (tq.payload->>'publication_id')::int AS publication_id,
            (tq.payload->>'platform') AS platform,
            (tq.payload->>'platform_post_id') AS platform_post_id
     FROM task_queue tq
     WHERE tq.task_type = 'measure'
       AND tq.status IN ('pending', 'queued')
     ORDER BY tq.priority DESC, tq.created_at ASC
     LIMIT $1`,
    [limit],
  );

  const tasks = res.rows.map((row) => ({
    task_id: row.task_id as number,
    publication_id: row.publication_id as number,
    platform: row.platform as Platform,
    platform_post_id: row.platform_post_id as string,
  }));

  return { tasks };
}
