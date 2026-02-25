/**
 * MCI-025: get_recent_reflections
 * Spec: 04-agent-design.md S4.12 #2
 * Returns the most recent self-reflections for a specific agent type.
 */
import type {
  GetRecentReflectionsInput,
  GetRecentReflectionsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_AGENT_TYPES = [
  'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator',
] as const;

export async function getRecentReflections(
  input: GetRecentReflectionsInput,
): Promise<GetRecentReflectionsOutput> {
  if (!VALID_AGENT_TYPES.includes(input.agent_type as typeof VALID_AGENT_TYPES[number])) {
    throw new McpValidationError(
      `Invalid agent_type: "${input.agent_type}". Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
    );
  }

  const limit = input.limit ?? 5;
  if (limit < 1 || limit > 50) {
    throw new McpValidationError('limit must be between 1 and 50');
  }

  const pool = getPool();

  const res = await pool.query(
    `SELECT self_score, score_reasoning, next_actions, created_at
     FROM agent_reflections
     WHERE agent_type = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [input.agent_type, limit],
  );

  return {
    reflections: res.rows.map((r: Record<string, unknown>) => ({
      self_score: r['self_score'] as number,
      score_reasoning: r['score_reasoning'] as string,
      next_actions: (r['next_actions'] as string[]) ?? [],
      created_at: (r['created_at'] as Date).toISOString(),
    })),
  };
}
