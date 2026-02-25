/**
 * MCI-037: get_component_scores
 * Spec: 04-agent-design.md §4.3 #9
 *
 * Queries components table for score/usage data filtered by type and subtype.
 */
import type {
  GetComponentScoresInput,
  GetComponentScoresOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_TYPES = ['scenario', 'motion', 'audio', 'image'] as const;

export async function getComponentScores(
  input: GetComponentScoresInput,
): Promise<GetComponentScoresOutput> {
  if (!VALID_TYPES.includes(input.type as typeof VALID_TYPES[number])) {
    throw new McpValidationError(
      `Invalid type: "${input.type}". Must be one of: ${VALID_TYPES.join(', ')}`,
    );
  }
  if (!input.subtype || input.subtype.trim().length === 0) {
    throw new McpValidationError('subtype is required');
  }

  const limit = input.limit ?? 20;
  if (limit < 1 || limit > 100) {
    throw new McpValidationError('limit must be between 1 and 100');
  }

  const pool = getPool();

  const res = await pool.query(
    `SELECT
       component_id,
       name,
       COALESCE(score, 0)::float AS score,
       usage_count
     FROM components
     WHERE type = $1
       AND subtype = $2
     ORDER BY score DESC NULLS LAST, usage_count DESC
     LIMIT $3`,
    [input.type, input.subtype, limit],
  );

  const components = res.rows.map((r: Record<string, unknown>) => ({
    component_id: r['component_id'] as string,
    name: r['name'] as string,
    score: Number(Number(r['score']).toFixed(2)),
    usage_count: Number(r['usage_count']),
  }));

  return { components };
}
