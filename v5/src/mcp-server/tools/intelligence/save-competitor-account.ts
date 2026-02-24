/**
 * FEAT-MCI-005: save_competitor_account
 * Spec: 04-agent-design.md §4.2 #3
 */
import type {
  SaveCompetitorAccountInput,
  SaveCompetitorAccountOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;

export async function saveCompetitorAccount(
  input: SaveCompetitorAccountInput,
): Promise<SaveCompetitorAccountOutput> {
  if (!VALID_PLATFORMS.includes(input.platform as any)) {
    throw new McpValidationError(
      `Invalid platform: "${input.platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`,
    );
  }

  if (!input.username || input.username.trim().length === 0) {
    throw new McpValidationError('username is required and must not be empty');
  }

  if (typeof input.followers !== 'number' || input.followers < 0) {
    throw new McpValidationError('followers must be a non-negative number');
  }

  if (!input.posting_frequency || input.posting_frequency.trim().length === 0) {
    throw new McpValidationError('posting_frequency is required and must not be empty');
  }

  const pool = getPool();
  const data = {
    username: input.username,
    followers: input.followers,
    posting_frequency: input.posting_frequency,
  };

  const res = await pool.query(
    `INSERT INTO market_intel (intel_type, platform, data, relevance_score)
     VALUES ('competitor_account', $1, $2, 1.0)
     RETURNING id`,
    [input.platform, JSON.stringify(data)],
  );

  return { id: res.rows[0].id };
}
