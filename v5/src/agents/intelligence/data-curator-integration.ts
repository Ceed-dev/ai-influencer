/**
 * FEAT-INT-018: Data curator integration with strategy cycle
 * Spec: 04-agent-design.md §4.10, 02-architecture.md §7
 *
 * Integration between the data curator agent and the strategy cycle.
 * Enqueues curation tasks during planning and processes curation results.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import type { ComponentType } from '@/types/database';

/** Curation task to be enqueued */
export interface CurationTask {
  contentId: string;
  dataType: string;
  rawData: Record<string, unknown>;
  source: string;
  priority: number;
}

/** Curation result after processing */
export interface CurationResult {
  taskId: number;
  componentIds: string[];
  status: 'completed' | 'failed';
  errorMessage?: string;
}

/**
 * Enqueue a curation task into the task_queue.
 * The data curator agent will pick it up and process it.
 */
export async function enqueueCurationTask(
  client: PoolClient,
  task: CurationTask,
): Promise<number> {
  const res = await client.query(
    `INSERT INTO task_queue (task_type, payload, status, priority)
     VALUES ('curate', $1, 'pending', $2)
     RETURNING id`,
    [
      JSON.stringify({
        content_id: task.contentId,
        data_type: task.dataType,
        raw_data: task.rawData,
        source: task.source,
      }),
      task.priority,
    ],
  );

  return (res.rows[0] as Record<string, unknown>)['id'] as number;
}

/**
 * Get pending curation tasks for the data curator.
 */
export async function getPendingCurationTasks(
  client: PoolClient,
  limit: number = 10,
): Promise<Array<{ taskId: number; payload: Record<string, unknown> }>> {
  const res = await client.query(
    `SELECT id, payload
     FROM task_queue
     WHERE task_type = 'curate' AND status = 'pending'
     ORDER BY priority DESC, created_at ASC
     LIMIT $1`,
    [limit],
  );

  return res.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      taskId: r['id'] as number,
      payload: r['payload'] as Record<string, unknown>,
    };
  });
}

/**
 * Mark a curation task as completed with resulting component IDs.
 */
export async function completeCurationTask(
  client: PoolClient,
  taskId: number,
  componentIds: string[],
): Promise<void> {
  await client.query(
    `UPDATE task_queue
     SET status = 'completed',
         completed_at = NOW(),
         payload = payload || $1
     WHERE id = $2`,
    [
      JSON.stringify({ result_component_ids: componentIds }),
      taskId,
    ],
  );
}

/**
 * Get components created by the data curator for a specific content.
 */
export async function getCuratedComponents(
  client: PoolClient,
  contentId: string,
  componentType?: ComponentType,
): Promise<Array<{
  componentId: string;
  type: ComponentType;
  name: string;
  score: number | null;
  curationConfidence: number | null;
}>> {
  let sql = `
    SELECT c.component_id, c.type, c.name, c.score, c.curation_confidence
    FROM components c
    JOIN content_sections cs ON cs.component_id = c.component_id
    WHERE cs.content_id = $1
      AND c.curated_by = 'auto'
  `;
  const params: unknown[] = [contentId];

  if (componentType) {
    sql += ` AND c.type = $2`;
    params.push(componentType);
  }

  sql += ` ORDER BY cs.section_order ASC`;

  const res = await client.query(sql, params);
  return res.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      componentId: r['component_id'] as string,
      type: r['type'] as ComponentType,
      name: r['name'] as string,
      score: r['score'] != null ? Number(r['score']) : null,
      curationConfidence: r['curation_confidence'] != null ? Number(r['curation_confidence']) : null,
    };
  });
}
