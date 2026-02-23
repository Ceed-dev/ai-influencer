/**
 * MCI-016: get_curation_queue — SELECT from components/market_intel
 * Spec: 04-agent-design.md §4.10 #1
 */
import type {
  GetCurationQueueInput,
  GetCurationQueueOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function getCurationQueue(
  input: GetCurationQueueInput,
): Promise<GetCurationQueueOutput> {
  const limit = input.limit ?? 10;
  if (limit < 1 || limit > 100) {
    throw new McpValidationError('limit must be between 1 and 100');
  }

  const pool = getPool();

  // Get uncurated market_intel items (those without components created from them)
  const res = await pool.query(
    `SELECT id, intel_type AS data_type, data AS raw_data,
            COALESCE(source_url, 'market_intel') AS source
     FROM market_intel
     WHERE (expires_at IS NULL OR expires_at > NOW())
     ORDER BY collected_at DESC
     LIMIT $1`,
    [limit],
  );

  return {
    items: res.rows.map((r: Record<string, unknown>) => ({
      id: r['id'] as number,
      source: r['source'] as string,
      raw_data: r['raw_data'] as Record<string, unknown>,
      data_type: r['data_type'] as string,
    })),
  };
}
