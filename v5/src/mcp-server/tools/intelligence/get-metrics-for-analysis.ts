/**
 * MCI-006: get_metrics_for_analysis
 * Spec: 04-agent-design.md §4.3 #1
 */
import type {
  GetMetricsForAnalysisInput,
  GetMetricsForAnalysisOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_SINCE = ['24h', '48h', '7d'] as const;

function sinceToInterval(since: '24h' | '48h' | '7d'): string {
  switch (since) {
    case '24h': return '24 hours';
    case '48h': return '48 hours';
    case '7d': return '7 days';
  }
}

export async function getMetricsForAnalysis(
  input: GetMetricsForAnalysisInput,
): Promise<GetMetricsForAnalysisOutput> {
  if (!VALID_SINCE.includes(input.since as typeof VALID_SINCE[number])) {
    throw new McpValidationError(
      `Invalid since: "${input.since}". Must be one of: ${VALID_SINCE.join(', ')}`,
    );
  }
  if (input.status !== 'measured') {
    throw new McpValidationError('status must be "measured"');
  }

  const pool = getPool();
  const interval = sinceToInterval(input.since);

  const res = await pool.query(
    `SELECT
       p.id AS publication_id,
       p.content_id,
       COALESCE(m.views, 0)::int AS views,
       COALESCE(m.engagement_rate, 0)::float AS engagement_rate,
       COALESCE(m.likes, 0)::int AS likes,
       COALESCE(m.comments, 0)::int AS comments,
       COALESCE(m.shares, 0)::int AS shares,
       p.platform,
       p.posted_at
     FROM publications p
     JOIN metrics m ON m.publication_id = p.id
     WHERE p.status = 'measured'
       AND m.measured_at >= NOW() - $1::interval
     ORDER BY m.measured_at DESC`,
    [interval],
  );

  return {
    metrics: res.rows.map((r: Record<string, unknown>) => ({
      publication_id: r['publication_id'] as number,
      content_id: r['content_id'] as string,
      views: Number(r['views']),
      engagement_rate: Number(Number(r['engagement_rate']).toFixed(4)),
      likes: Number(r['likes']),
      comments: Number(r['comments']),
      shares: Number(r['shares']),
      platform: r['platform'] as 'youtube' | 'tiktok' | 'instagram' | 'x',
      posted_at: r['posted_at'] ? (r['posted_at'] as Date).toISOString() : '',
    })),
  };
}
