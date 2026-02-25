/**
 * FEAT-MS-002: Metrics insertion into metrics table
 * Spec: 04-agent-design.md §4.8 (#7), 03-database-schema.md §3.3
 *
 * INSERTs collected metrics (views, likes, comments, shares) into the metrics table.
 * Updates publication status to 'measured' after successful insertion.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import type { MeasurementPoint, PlatformData } from '@/types/database';

/** Input for metrics insertion */
export interface MetricsInsertInput {
  publicationId: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves?: number | null;
  watchTimeSeconds?: number | null;
  completionRate?: number | null;
  engagementRate: number | null;
  followerDelta?: number | null;
  impressions?: number | null;
  reach?: number | null;
  platformData?: PlatformData | null;
  measurementPoint: MeasurementPoint;
  rawData?: Record<string, unknown> | null;
}

/** Result of metrics insertion */
export interface MetricsInsertResult {
  metricId: number;
  publicationId: number;
  measurementPoint: MeasurementPoint;
  publicationStatusUpdated: boolean;
}

/**
 * Calculate engagement rate from individual metrics.
 * Formula: (likes + comments + shares + saves) / views
 */
export function calculateEngagementRate(
  views: number | null,
  likes: number | null,
  comments: number | null,
  shares: number | null,
  saves?: number | null,
): number | null {
  if (!views || views === 0) return null;
  const interactions = (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0);
  return interactions / views;
}

/**
 * Insert metrics for a publication.
 * Creates a new metrics record and optionally updates publication status.
 */
export async function insertMetrics(
  client: PoolClient,
  input: MetricsInsertInput,
): Promise<MetricsInsertResult> {
  // Calculate engagement rate if not provided
  const engagementRate = input.engagementRate ??
    calculateEngagementRate(input.views, input.likes, input.comments, input.shares, input.saves);

  // INSERT metrics record
  const metricsRes = await client.query(
    `INSERT INTO metrics
       (publication_id, views, likes, comments, shares, saves,
        watch_time_seconds, completion_rate, engagement_rate,
        follower_delta, impressions, reach, platform_data,
        measurement_point, raw_data, measured_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
     RETURNING id`,
    [
      input.publicationId,
      input.views,
      input.likes,
      input.comments,
      input.shares,
      input.saves ?? null,
      input.watchTimeSeconds ?? null,
      input.completionRate ?? null,
      engagementRate,
      input.followerDelta ?? null,
      input.impressions ?? null,
      input.reach ?? null,
      input.platformData ? JSON.stringify(input.platformData) : null,
      input.measurementPoint,
      input.rawData ? JSON.stringify(input.rawData) : null,
    ],
  );

  const metricId = (metricsRes.rows[0] as Record<string, unknown>)['id'] as number;

  // Update publication status to 'measured' if this is the first measurement
  const pubRes = await client.query(
    `UPDATE publications
     SET status = 'measured', updated_at = NOW()
     WHERE id = $1 AND status = 'posted'`,
    [input.publicationId],
  );

  const publicationStatusUpdated = (pubRes.rowCount ?? 0) > 0;

  return {
    metricId,
    publicationId: input.publicationId,
    measurementPoint: input.measurementPoint,
    publicationStatusUpdated,
  };
}

/**
 * Batch insert metrics for multiple publications.
 */
export async function batchInsertMetrics(
  client: PoolClient,
  inputs: MetricsInsertInput[],
): Promise<MetricsInsertResult[]> {
  const results: MetricsInsertResult[] = [];
  for (const input of inputs) {
    const result = await insertMetrics(client, input);
    results.push(result);
  }
  return results;
}
