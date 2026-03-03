/**
 * Publication recorder — FEAT-TP-006
 * Spec: 04-agent-design.md §4.7 (report_publish_result), §5.3 (record node)
 *
 * After successful platform posting:
 * 1. UPDATE existing publications record (scheduled → posted) with platform_post_id, posted_at, etc.
 *    Falls back to INSERT if no 'scheduled' record exists.
 * 2. Set measure_after = posted_at + METRICS_COLLECTION_DELAY_HOURS
 * 3. INSERT task_queue measure task for future metrics collection
 */
import type { Platform, PublicationMetadata } from '@/types/database';
import { getPool } from '../../db/pool';
import { getSettingNumber } from '../../lib/settings';

/** Input for recording a publication */
export interface RecordPublicationInput {
  content_id: string;
  account_id: string;
  platform: Platform;
  platform_post_id: string;
  post_url: string;
  posted_at: string;
  metadata?: PublicationMetadata | null;
}

/** Result of recording a publication */
export interface RecordPublicationResult {
  publication_id: number;
  measure_after: string;
  measure_task_id: number;
}

/**
 * Calculate measure_after timestamp from posted_at + METRICS_COLLECTION_DELAY_HOURS.
 *
 * @param postedAt - ISO 8601 timestamp when the content was posted
 * @param delayHours - Hours to delay before measurement (from system_settings)
 * @returns ISO 8601 timestamp for when measurement should occur
 */
export function calculateMeasureAfter(postedAt: string, delayHours: number): string {
  const postedDate = new Date(postedAt);
  const measureDate = new Date(postedDate.getTime() + delayHours * 60 * 60 * 1000);
  return measureDate.toISOString();
}

/**
 * Record a successful publication and schedule measurement.
 *
 * Updates existing 'scheduled' publication (created by scheduleForPublishing)
 * to 'posted' with platform details. Falls back to INSERT if no scheduled
 * record exists (defensive).
 *
 * Also creates a task_queue entry for measurement (type='measure').
 *
 * All operations are done within a transaction.
 */
export async function recordPublication(
  input: RecordPublicationInput,
): Promise<RecordPublicationResult> {
  const pool = getPool();
  const delayHours = await getSettingNumber('METRICS_COLLECTION_DELAY_HOURS');
  const measureAfter = calculateMeasureAfter(input.posted_at, delayHours);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Try to UPDATE existing 'scheduled' publication record
    const updateResult = await client.query<{ id: number }>(
      `UPDATE publications
         SET platform_post_id = $3,
             posted_at = $4,
             post_url = $5,
             measure_after = $6,
             status = 'posted',
             metadata = COALESCE($7::jsonb, metadata),
             updated_at = NOW()
       WHERE content_id = $1
         AND account_id = $2
         AND status = 'scheduled'
       RETURNING id`,
      [
        input.content_id,
        input.account_id,
        input.platform_post_id,
        input.posted_at,
        input.post_url,
        measureAfter,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );

    let publicationId: number;

    if (updateResult.rows.length > 0) {
      // Updated existing scheduled publication
      publicationId = updateResult.rows[0]!.id;
    } else {
      // Fallback: INSERT if no scheduled record exists (defensive)
      console.warn(
        `[publish-recorder] No 'scheduled' publication found for content=${input.content_id}, account=${input.account_id} — inserting new record`,
      );
      const insertResult = await client.query<{ id: number }>(
        `INSERT INTO publications (content_id, account_id, platform, platform_post_id, posted_at, post_url, measure_after, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'posted', $8)
         RETURNING id`,
        [
          input.content_id,
          input.account_id,
          input.platform,
          input.platform_post_id,
          input.posted_at,
          input.post_url,
          measureAfter,
          input.metadata ? JSON.stringify(input.metadata) : null,
        ],
      );
      publicationId = insertResult.rows[0]!.id;
    }

    // 2. INSERT measure task into task_queue
    const taskResult = await client.query(
      `INSERT INTO task_queue (task_type, payload, status, priority)
       VALUES ('measure', $1, 'queued', 0)
       RETURNING id`,
      [
        JSON.stringify({
          publication_id: publicationId,
          content_id: input.content_id,
          account_id: input.account_id,
          platform: input.platform,
          platform_post_id: input.platform_post_id,
          measure_after: measureAfter,
        }),
      ],
    );

    const measureTaskId = taskResult.rows[0]!.id as number;

    await client.query('COMMIT');

    return {
      publication_id: publicationId,
      measure_after: measureAfter,
      measure_task_id: measureTaskId,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
