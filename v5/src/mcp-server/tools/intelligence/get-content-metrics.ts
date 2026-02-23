/**
 * MCI-033: get_content_metrics
 * Spec: 04-agent-design.md §4.12 #12 / §4.3 #16
 */
import type {
  GetContentMetricsInput,
  GetContentMetricsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function getContentMetrics(
  input: GetContentMetricsInput,
): Promise<GetContentMetricsOutput> {
  if (!input.content_id || input.content_id.trim().length === 0) {
    throw new McpValidationError('content_id is required');
  }

  const pool = getPool();

  const res = await pool.query(
    `SELECT
       p.id AS publication_id,
       p.platform,
       m.views, m.likes, m.comments, m.shares, m.engagement_rate,
       m.completion_rate, m.measured_at
     FROM publications p
     LEFT JOIN metrics m ON m.publication_id = p.id
     WHERE p.content_id = $1
     ORDER BY p.id`,
    [input.content_id],
  );

  const publications: Array<{
    publication_id: number;
    platform: string;
    metrics: Record<string, number> | null;
    measured_at: string | null;
  }> = [];

  const kpiSums: Record<string, { sum: number; count: number }> = {};

  for (const r of res.rows as Array<Record<string, unknown>>) {
    const hasMetrics = r['measured_at'] != null;
    let metricsObj: Record<string, number> | null = null;

    if (hasMetrics) {
      metricsObj = {
        views: Number(r['views'] ?? 0),
        likes: Number(r['likes'] ?? 0),
        comments: Number(r['comments'] ?? 0),
        shares: Number(r['shares'] ?? 0),
        engagement_rate: Number(r['engagement_rate'] ?? 0),
        completion_rate: Number(r['completion_rate'] ?? 0),
      };

      for (const [key, val] of Object.entries(metricsObj)) {
        if (!kpiSums[key]) {
          kpiSums[key] = { sum: 0, count: 0 };
        }
        const entry = kpiSums[key];
        if (entry) {
          entry.sum += val;
          entry.count += 1;
        }
      }
    }

    publications.push({
      publication_id: r['publication_id'] as number,
      platform: r['platform'] as string,
      metrics: metricsObj,
      measured_at: hasMetrics ? (r['measured_at'] as Date).toISOString() : null,
    });
  }

  const aggregatedKpis: Record<string, number> = {};
  for (const [key, val] of Object.entries(kpiSums)) {
    aggregatedKpis[key] = val.count > 0 ? Number((val.sum / val.count).toFixed(4)) : 0;
  }

  return {
    content_id: input.content_id,
    publications,
    aggregated_kpis: aggregatedKpis,
  };
}
