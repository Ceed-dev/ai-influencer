/**
 * FEAT-MS-005: フォローアップ計測スケジュール (7d/30d)
 * Spec: 04-agent-design.md §4.8, 03-database-schema.md §3.3
 *
 * After initial 48h measurement, schedules follow-up measurements
 * at 7d and 30d based on METRICS_FOLLOWUP_DAYS from system_settings.
 * Creates task_queue entries with type='measure' and measurement_type='7d'/'30d'.
 */
import type { PoolClient } from 'pg';
import type { MeasurementPoint } from '../../types/database.js';
import { getSetting } from '../../lib/settings.js';

/**
 * Get the follow-up measurement intervals from system_settings.
 * Default: [7, 30] (days after posting).
 */
export async function getFollowupDays(client: PoolClient): Promise<number[]> {
  const val = await getSetting('METRICS_FOLLOWUP_DAYS', client);
  if (Array.isArray(val)) return val.map(Number);
  if (typeof val === 'string') {
    try { return JSON.parse(val).map(Number); } catch { return [7, 30]; }
  }
  return [7, 30];
}

/**
 * Convert days to measurement_point string.
 */
function daysToMeasurementPoint(days: number): MeasurementPoint {
  if (days <= 1) return '48h';
  if (days <= 7) return '7d';
  return '30d';
}

/**
 * Schedule follow-up measurement tasks for a publication.
 * Called after initial 48h measurement completes.
 *
 * For each follow-up day, creates a task_queue entry if:
 * 1. No metrics row exists for that measurement_point yet
 * 2. No pending measure task exists for that measurement_point
 */
export async function scheduleFollowups(
  client: PoolClient,
  publicationId: number,
  platform: string,
  platformPostId: string,
): Promise<string[]> {
  const followupDays = await getFollowupDays(client);
  const scheduled: string[] = [];

  for (const days of followupDays) {
    const measurementPoint = daysToMeasurementPoint(days);

    // Skip if metrics already exist for this measurement point
    const existsRes = await client.query(
      'SELECT 1 FROM metrics WHERE publication_id = $1 AND measurement_point = $2',
      [publicationId, measurementPoint],
    );
    if (existsRes.rows.length > 0) continue;

    // Skip if a pending measure task already exists for this publication + measurement type
    const taskExistsRes = await client.query(`
      SELECT 1 FROM task_queue
      WHERE task_type = 'measure'
        AND status IN ('pending', 'queued', 'processing')
        AND (payload->>'publication_id')::int = $1
        AND payload->>'measurement_type' = $2
    `, [publicationId, measurementPoint]);
    if (taskExistsRes.rows.length > 0) continue;

    // Get posted_at for scheduling
    const pubRes = await client.query(
      'SELECT posted_at FROM publications WHERE id = $1',
      [publicationId],
    );
    if (pubRes.rows.length === 0) continue;

    const postedAt = new Date(pubRes.rows[0].posted_at);

    // Create follow-up measure task (scheduled for posted_at + N days)
    await client.query(`
      INSERT INTO task_queue (task_type, payload, status, priority, created_at)
      VALUES ('measure', $1, 'pending', 0, NOW())
    `, [JSON.stringify({
      publication_id: publicationId,
      platform,
      platform_post_id: platformPostId,
      measurement_type: measurementPoint,
      scheduled_after: new Date(postedAt.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
    })]);

    scheduled.push(measurementPoint);
  }

  return scheduled;
}
