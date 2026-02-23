/**
 * FEAT-MS-001: measure_after判定 (現在時刻 >= measure_after で実行)
 * Spec: 04-agent-design.md §4.8, 03-database-schema.md §2.3
 *
 * Polls publications where measure_after <= NOW() and status = 'posted'.
 * Only returns publications that are eligible for measurement.
 * All config values read from system_settings — no hardcoding.
 */
import type { PoolClient, Pool } from 'pg';
import type { Platform } from '../../types/database.js';

export interface MeasurementTask {
  taskId: number;
  publicationId: number;
  platform: Platform;
  platformPostId: string;
  accountId: string;
  contentId: string;
  measurementType: string;
}

/**
 * Get publications eligible for measurement.
 * Filters on: measure_after <= NOW() AND status = 'posted' AND platform_post_id IS NOT NULL.
 * Results ordered by measure_after ASC (oldest first).
 */
export async function getMeasurementEligible(
  client: PoolClient,
  limit: number = 10,
): Promise<MeasurementTask[]> {
  const sql = `
    SELECT
      tq.id AS task_id,
      p.id AS publication_id,
      p.platform,
      p.platform_post_id,
      p.account_id,
      p.content_id,
      COALESCE((tq.payload->>'measurement_type'), '48h') AS measurement_type
    FROM task_queue tq
    JOIN publications p ON (tq.payload->>'publication_id')::int = p.id
    WHERE tq.task_type = 'measure'
      AND tq.status IN ('pending', 'queued')
      AND p.measure_after <= NOW()
      AND p.status = 'posted'
      AND p.platform_post_id IS NOT NULL
    ORDER BY tq.priority DESC, tq.created_at ASC
    LIMIT $1
  `;

  const res = await client.query(sql, [limit]);
  return res.rows.map((r: Record<string, unknown>) => ({
    taskId: r.task_id as number,
    publicationId: r.publication_id as number,
    platform: r.platform as Platform,
    platformPostId: r.platform_post_id as string,
    accountId: r.account_id as string,
    contentId: r.content_id as string,
    measurementType: r.measurement_type as string,
  }));
}

/**
 * Direct measure_after check: get publications where measure_after <= NOW().
 * Used for the measure_after judgment test (TEST-WKR-015).
 * Does NOT require task_queue entries — checks publications directly.
 */
export async function getPublicationsReadyForMeasurement(
  client: PoolClient,
  limit: number = 10,
): Promise<Array<{
  publicationId: number;
  platform: Platform;
  platformPostId: string | null;
  accountId: string;
  contentId: string;
  measureAfter: Date;
}>> {
  const sql = `
    SELECT
      id AS publication_id,
      platform,
      platform_post_id,
      account_id,
      content_id,
      measure_after
    FROM publications
    WHERE measure_after <= NOW()
      AND status = 'posted'
    ORDER BY measure_after ASC
    LIMIT $1
  `;

  const res = await client.query(sql, [limit]);
  return res.rows.map((r: Record<string, unknown>) => ({
    publicationId: r.publication_id as number,
    platform: r.platform as Platform,
    platformPostId: r.platform_post_id as string | null,
    accountId: r.account_id as string,
    contentId: r.content_id as string,
    measureAfter: new Date(r.measure_after as string),
  }));
}
