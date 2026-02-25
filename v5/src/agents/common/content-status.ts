/**
 * FEAT-INT-008: Content status transition module
 * Spec: 02-architecture.md §3.7, §8.1–8.2
 *
 * All graph-to-graph communication happens ONLY through PostgreSQL
 * status changes. This module enforces valid status transitions
 * for the content table.
 *
 * Content lifecycle:
 *   pending_approval → planned → producing → ready → posted → measured → analyzed
 *   Any state → error | cancelled (terminal)
 */
import type { PoolClient } from 'pg';
import type { ContentStatus } from '@/types/langgraph-state';

/** Valid content status transitions (from → allowed destinations) */
const VALID_TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  pending_approval: ['planned', 'cancelled', 'error'],
  planned: ['producing', 'cancelled', 'error'],
  producing: ['ready', 'error', 'cancelled'],
  ready: ['posted', 'error', 'cancelled'],
  posted: ['measured', 'error'],
  measured: ['analyzed', 'error'],
  analyzed: [],
  error: [],
  cancelled: [],
};

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(from: ContentStatus, to: ContentStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Transition content status in the database.
 * Enforces valid transitions — throws on invalid transition.
 * Returns the updated row count.
 */
export async function transitionContentStatus(
  client: PoolClient,
  contentId: string,
  fromStatus: ContentStatus,
  toStatus: ContentStatus,
): Promise<number> {
  if (!isValidTransition(fromStatus, toStatus)) {
    throw new Error(
      `Invalid content status transition: ${fromStatus} → ${toStatus} (content_id=${contentId})`
    );
  }

  const result = await client.query(
    `UPDATE content SET status = $1, updated_at = NOW()
     WHERE content_id = $2 AND status = $3`,
    [toStatus, contentId, fromStatus]
  );

  return result.rowCount ?? 0;
}

/**
 * Poll for content items at a specific status.
 * Used by graphs to detect work items via DB polling (no direct graph communication).
 */
export async function pollContentByStatus(
  client: PoolClient,
  status: ContentStatus,
  limit: number = 10,
): Promise<Array<{ content_id: string; content_format: string; recipe_id: number | null; account_id: string; character_id: string }>> {
  const result = await client.query(
    `SELECT content_id, content_format, recipe_id, account_id, character_id
     FROM content
     WHERE status = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [status, limit]
  );

  return result.rows;
}

/**
 * Get current status of a content item.
 */
export async function getContentStatus(
  client: PoolClient,
  contentId: string,
): Promise<ContentStatus | null> {
  const result = await client.query(
    `SELECT status FROM content WHERE content_id = $1`,
    [contentId]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0].status as ContentStatus;
}
