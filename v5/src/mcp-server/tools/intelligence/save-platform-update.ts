/**
 * FEAT-MCI-005: save_platform_update
 * Spec: 04-agent-design.md §4.2 #5
 */
import type {
  SavePlatformUpdateInput,
  SavePlatformUpdateOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'x'] as const;

export async function savePlatformUpdate(
  input: SavePlatformUpdateInput,
): Promise<SavePlatformUpdateOutput> {
  if (!VALID_PLATFORMS.includes(input.platform as any)) {
    throw new McpValidationError(
      `Invalid platform: "${input.platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`,
    );
  }

  if (!input.update_type || input.update_type.trim().length === 0) {
    throw new McpValidationError('update_type is required and must not be empty');
  }

  if (!input.description || input.description.trim().length === 0) {
    throw new McpValidationError('description is required and must not be empty');
  }

  if (!input.effective_date || input.effective_date.trim().length === 0) {
    throw new McpValidationError('effective_date is required and must not be empty');
  }

  // Validate ISO 8601 date format
  const parsed = Date.parse(input.effective_date);
  if (isNaN(parsed)) {
    throw new McpValidationError(
      `Invalid effective_date: "${input.effective_date}". Must be a valid ISO 8601 date string`,
    );
  }

  const pool = getPool();
  const data = {
    update_type: input.update_type,
    description: input.description,
    effective_date: input.effective_date,
  };

  const res = await pool.query(
    `INSERT INTO market_intel (intel_type, platform, data, relevance_score)
     VALUES ('platform_update', $1, $2, 1.0)
     RETURNING id`,
    [input.platform, JSON.stringify(data)],
  );

  return { id: res.rows[0].id };
}
