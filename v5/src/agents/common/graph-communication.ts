/**
 * FEAT-INT-008: Graph communication module
 * Spec: 02-architecture.md §3.7, 04-agent-design.md §5.5
 *
 * All 4 LangGraph graphs communicate EXCLUSIVELY through PostgreSQL
 * status changes. This module provides the task queue interface for
 * inter-graph coordination.
 *
 * Communication pattern:
 *   Strategy Cycle → content.status='planned' → Production Pipeline detects
 *   Production Pipeline → content.status='ready' → Publishing Scheduler detects
 *   Publishing Scheduler → publications.status='posted' → Measurement Jobs detects
 *
 * Task queue types:
 *   produce  — Strategy → Production
 *   publish  — Production → Publishing
 *   measure  — Publishing → Measurement
 *   curate   — Planner → Data Curator
 */
import type { PoolClient } from 'pg';
import type { TaskQueueType } from '@/types/langgraph-state';

export interface TaskQueueEntry {
  id: number;
  task_type: TaskQueueType;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

/**
 * Enqueue a task for another graph to pick up.
 * This is the ONLY mechanism for inter-graph communication.
 */
export async function enqueueTask(
  client: PoolClient,
  taskType: TaskQueueType,
  payload: Record<string, unknown>,
): Promise<number> {
  const result = await client.query(
    `INSERT INTO task_queue (task_type, payload, status, created_at)
     VALUES ($1, $2, 'pending', NOW())
     RETURNING id`,
    [taskType, JSON.stringify(payload)]
  );

  return result.rows[0].id;
}

/**
 * Dequeue a pending task (claim it for processing).
 * Uses SELECT ... FOR UPDATE SKIP LOCKED for concurrent safety.
 */
export async function dequeueTask(
  client: PoolClient,
  taskType: TaskQueueType,
): Promise<TaskQueueEntry | null> {
  const result = await client.query(
    `UPDATE task_queue SET status = 'processing', started_at = NOW()
     WHERE id = (
       SELECT id FROM task_queue
       WHERE task_type = $1 AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, task_type, payload, status, created_at`,
    [taskType]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0] as TaskQueueEntry;
}

/**
 * Mark a task as completed.
 */
export async function completeTask(
  client: PoolClient,
  taskId: number,
): Promise<void> {
  await client.query(
    `UPDATE task_queue SET status = 'completed', completed_at = NOW()
     WHERE id = $1`,
    [taskId]
  );
}

/**
 * Mark a task as failed.
 */
export async function failTask(
  client: PoolClient,
  taskId: number,
  errorMessage?: string,
): Promise<void> {
  await client.query(
    `UPDATE task_queue SET status = 'failed', last_error_at = NOW(),
     error_message = ($2::jsonb)->>'error'
     WHERE id = $1`,
    [taskId, JSON.stringify({ error: errorMessage })]
  );
}

/**
 * Count pending tasks of a given type.
 */
export async function countPendingTasks(
  client: PoolClient,
  taskType: TaskQueueType,
): Promise<number> {
  const result = await client.query(
    `SELECT COUNT(*)::int as count FROM task_queue
     WHERE task_type = $1 AND status = 'pending'`,
    [taskType]
  );

  return result.rows[0].count;
}
