/**
 * FEAT-MCC-009: get_available_components
 * Spec: 04-agent-design.md S4.4 #3
 * Returns components filtered by type, niche, and optionally subtype.
 */
import type {
  GetAvailableComponentsInput,
  GetAvailableComponentsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_TYPES = ['scenario', 'motion', 'audio', 'image'] as const;

export async function getAvailableComponents(
  input: GetAvailableComponentsInput,
): Promise<GetAvailableComponentsOutput> {
  if (!VALID_TYPES.includes(input.type as typeof VALID_TYPES[number])) {
    throw new McpValidationError(
      `Invalid type: "${input.type}". Must be one of: ${VALID_TYPES.join(', ')}`,
    );
  }
  if (!input.niche || input.niche.trim().length === 0) {
    throw new McpValidationError('niche is required');
  }

  const pool = getPool();
  const conditions: string[] = ['type = $1', '(niche = $2 OR niche IS NULL)'];
  const params: unknown[] = [input.type, input.niche];
  let paramIdx = 3;

  if (input.subtype) {
    conditions.push(`subtype = $${paramIdx++}`);
    params.push(input.subtype);
  }

  const res = await pool.query(
    `SELECT component_id, name, COALESCE(score, 0)::float AS score, usage_count, data
     FROM components
     WHERE ${conditions.join(' AND ')}
     ORDER BY score DESC NULLS LAST, usage_count DESC
     LIMIT 50`,
    params,
  );

  return {
    components: res.rows.map((r: Record<string, unknown>) => ({
      component_id: r['component_id'] as string,
      name: r['name'] as string,
      score: Number(r['score']),
      usage_count: r['usage_count'] as number,
      data: (r['data'] as Record<string, unknown>) ?? {},
    })),
  };
}
