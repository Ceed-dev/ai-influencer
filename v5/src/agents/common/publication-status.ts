/**
 * FEAT-INT-008: Publication status transition module
 * Spec: 02-architecture.md §3.7
 *
 * Publication lifecycle (per-platform post of a single content):
 *   scheduled → posted → measured
 *
 * One content can produce N publications (one per platform/account).
 */
import type { PoolClient } from 'pg';
import type { PublicationStatus, Platform } from '@/types/langgraph-state';

/** Valid publication status transitions */
const VALID_TRANSITIONS: Record<PublicationStatus, PublicationStatus[]> = {
  scheduled: ['posted'],
  posted: ['measured'],
  measured: [],
};

/**
 * Check if a publication status transition is valid.
 */
export function isValidTransition(from: PublicationStatus, to: PublicationStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Transition publication status in the database.
 * Enforces valid transitions.
 */
export async function transitionPublicationStatus(
  client: PoolClient,
  publicationId: number,
  fromStatus: PublicationStatus,
  toStatus: PublicationStatus,
): Promise<number> {
  if (!isValidTransition(fromStatus, toStatus)) {
    throw new Error(
      `Invalid publication status transition: ${fromStatus} → ${toStatus} (publication_id=${publicationId})`
    );
  }

  const result = await client.query(
    `UPDATE publications SET status = $1, updated_at = NOW()
     WHERE id = $2 AND status = $3`,
    [toStatus, publicationId, fromStatus]
  );

  return result.rowCount ?? 0;
}

/**
 * Poll for publications at a specific status.
 * Used by publishing scheduler and measurement jobs graphs.
 */
export async function pollPublicationsByStatus(
  client: PoolClient,
  status: PublicationStatus,
  limit: number = 10,
): Promise<Array<{ id: number; content_id: string; account_id: string; platform: Platform; platform_post_id: string | null; posted_at: string | null; measure_after: string | null }>> {
  const result = await client.query(
    `SELECT id, content_id, account_id, platform, platform_post_id, posted_at, measure_after
     FROM publications
     WHERE status = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [status, limit]
  );

  return result.rows;
}

/**
 * Poll for publications needing measurement (measure_after has passed).
 * Used by measurement jobs graph to detect targets.
 */
export async function pollPublicationsForMeasurement(
  client: PoolClient,
  limit: number = 10,
): Promise<Array<{ id: number; content_id: string; account_id: string; platform: Platform; platform_post_id: string; posted_at: string; measure_after: string }>> {
  const result = await client.query(
    `SELECT id, content_id, account_id, platform, platform_post_id, posted_at, measure_after
     FROM publications
     WHERE status = 'posted'
       AND measure_after IS NOT NULL
       AND measure_after <= NOW()
     ORDER BY measure_after ASC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}
