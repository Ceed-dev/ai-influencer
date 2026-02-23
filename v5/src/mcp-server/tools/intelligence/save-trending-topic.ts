/**
 * FEAT-MCI-001: save_trending_topic + platform validation
 * Spec: 04-agent-design.md §4.2 #1
 */
import type {
  SaveTrendingTopicInput,
  SaveTrendingTopicOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;

export async function saveTrendingTopic(
  input: SaveTrendingTopicInput,
): Promise<SaveTrendingTopicOutput> {
  if (!VALID_PLATFORMS.includes(input.platform as any)) {
    throw new McpValidationError(
      `Invalid platform: "${input.platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`,
    );
  }

  const pool = getPool();
  const data = {
    topic: input.topic,
    volume: input.volume,
    growth_rate: input.growth_rate,
  };

  const res = await pool.query(
    `INSERT INTO market_intel (intel_type, platform, niche, data, relevance_score)
     VALUES ('trending_topic', $1, $2, $3, $4)
     RETURNING id`,
    [input.platform, input.niche, JSON.stringify(data), 1.0],
  );

  return { id: res.rows[0].id };
}
