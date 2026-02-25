/**
 * FEAT-MCI-005: get_competitor_analysis
 * Spec: 04-agent-design.md §4.2 #9
 */
import type {
  GetCompetitorAnalysisInput,
  GetCompetitorAnalysisOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;

export async function getCompetitorAnalysis(
  input: GetCompetitorAnalysisInput,
): Promise<GetCompetitorAnalysisOutput> {
  if (!VALID_PLATFORMS.includes(input.platform as any)) {
    throw new McpValidationError(
      `Invalid platform: "${input.platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`,
    );
  }

  if (!input.niche || input.niche.trim().length === 0) {
    throw new McpValidationError('niche is required and must not be empty');
  }

  const pool = getPool();

  // Get competitor accounts for the given platform
  // Join with competitor_post data to calculate avg_views
  const res = await pool.query(
    `WITH accounts AS (
       SELECT
         data->>'username' AS username,
         COALESCE((data->>'followers')::bigint, 0) AS followers
       FROM market_intel
       WHERE intel_type = 'competitor_account'
         AND platform = $1
         AND (expires_at IS NULL OR expires_at > NOW())
     ),
     posts AS (
       SELECT
         data->>'post_url' AS post_url,
         COALESCE((data->>'views')::bigint, 0) AS views,
         data->>'format' AS format,
         data->>'hook_technique' AS hook_technique
       FROM market_intel
       WHERE intel_type = 'competitor_post'
         AND platform = $1
         AND (expires_at IS NULL OR expires_at > NOW())
     )
     SELECT
       a.username,
       a.followers,
       COALESCE((SELECT AVG(p.views) FROM posts p), 0)::float AS avg_views,
       COALESCE(
         (SELECT string_agg(DISTINCT p.format, ', ') FROM posts p),
         'unknown'
       ) AS content_strategy
     FROM accounts a
     ORDER BY a.followers DESC
     LIMIT 50`,
    [input.platform],
  );

  return {
    competitors: res.rows.map((r: Record<string, unknown>) => ({
      username: (r['username'] as string) ?? '',
      followers: Number(r['followers']),
      avg_views: Number(r['avg_views']),
      content_strategy: (r['content_strategy'] as string) ?? 'unknown',
    })),
  };
}
