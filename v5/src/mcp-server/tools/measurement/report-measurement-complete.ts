/**
 * FEAT-MCC-031: report_measurement_complete
 * Spec: 04-agent-design.md §4.8 #7
 * Inserts metrics data into metrics table and updates the task_queue status to completed.
 */
import type {
  ReportMeasurementCompleteInput,
  ReportMeasurementCompleteOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpDbError } from '../../errors';

export async function reportMeasurementComplete(
  input: ReportMeasurementCompleteInput,
): Promise<ReportMeasurementCompleteOutput> {
  if (typeof input.task_id !== 'number' || input.task_id < 1) {
    throw new McpValidationError('task_id must be a positive number');
  }
  if (typeof input.publication_id !== 'number' || input.publication_id < 1) {
    throw new McpValidationError('publication_id must be a positive number');
  }
  if (!input.metrics_data || typeof input.metrics_data !== 'object') {
    throw new McpValidationError('metrics_data must be a non-null object');
  }

  const pool = getPool();

  // Insert metrics
  const views = input.metrics_data['views'] ?? null;
  const likes = input.metrics_data['likes'] ?? null;
  const comments = input.metrics_data['comments'] ?? null;
  const shares = input.metrics_data['shares'] ?? null;
  const saves = input.metrics_data['saves'] ?? null;
  const engagementRate = input.metrics_data['engagement_rate'] ?? null;
  const followerDelta = input.metrics_data['follower_delta'] ?? null;
  const impressions = input.metrics_data['impressions'] ?? null;
  const reach = input.metrics_data['reach'] ?? null;

  const measurementPoint = (input as unknown as Record<string, unknown>)['measurement_point'] ?? '48h';

  const insertRes = await pool.query(
    `INSERT INTO metrics (publication_id, views, likes, comments, shares, saves,
                          engagement_rate, follower_delta, impressions, reach, measurement_point)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (publication_id, measurement_point)
     DO UPDATE SET
       views = EXCLUDED.views,
       likes = EXCLUDED.likes,
       comments = EXCLUDED.comments,
       shares = EXCLUDED.shares,
       saves = EXCLUDED.saves,
       engagement_rate = EXCLUDED.engagement_rate,
       follower_delta = EXCLUDED.follower_delta,
       impressions = EXCLUDED.impressions,
       reach = EXCLUDED.reach,
       measured_at = NOW()
     RETURNING id`,
    [input.publication_id, views, likes, comments, shares, saves,
     engagementRate, followerDelta, impressions, reach, measurementPoint],
  );

  if (insertRes.rowCount === 0) {
    throw new McpDbError('Failed to insert metrics record');
  }

  // Update task_queue status to completed
  const updateRes = await pool.query(
    `UPDATE task_queue
     SET status = 'completed', completed_at = NOW()
     WHERE id = $1`,
    [input.task_id],
  );

  if (updateRes.rowCount === 0) {
    throw new McpDbError(`Failed to update task_queue row id=${input.task_id} to completed`);
  }

  return { success: true };
}
