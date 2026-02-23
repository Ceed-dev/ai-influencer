/**
 * FEAT-MCI-002: save_competitor_post
 * Spec: 04-agent-design.md §4.2 #2
 */
import type {
  SaveCompetitorPostInput,
  SaveCompetitorPostOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;

export async function saveCompetitorPost(
  input: SaveCompetitorPostInput,
): Promise<SaveCompetitorPostOutput> {
  if (!VALID_PLATFORMS.includes(input.platform as any)) {
    throw new McpValidationError(
      `Invalid platform: "${input.platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`,
    );
  }

  const pool = getPool();
  const data = {
    post_url: input.post_url,
    views: input.views,
    format: input.format,
    hook_technique: input.hook_technique,
  };

  const res = await pool.query(
    `INSERT INTO market_intel (intel_type, platform, data, relevance_score)
     VALUES ('competitor_post', $1, $2, 1.0)
     RETURNING id`,
    [input.platform, JSON.stringify(data)],
  );

  return { id: res.rows[0].id };
}
