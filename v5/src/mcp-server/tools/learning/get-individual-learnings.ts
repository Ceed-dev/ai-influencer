/**
 * MCI-022: get_individual_learnings — filter by agent_type
 * Spec: 04-agent-design.md §4.12 #4
 */
import type {
  GetIndividualLearningsInput,
  GetIndividualLearningsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_AGENT_TYPES = [
  'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator',
] as const;

export async function getIndividualLearnings(
  input: GetIndividualLearningsInput,
): Promise<GetIndividualLearningsOutput> {
  if (!VALID_AGENT_TYPES.includes(input.agent_type as typeof VALID_AGENT_TYPES[number])) {
    throw new McpValidationError(
      `Invalid agent_type: "${input.agent_type}". Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
    );
  }

  const limit = input.limit ?? 20;
  const pool = getPool();

  const conditions: string[] = ['agent_type = $1', 'is_active = true'];
  const params: unknown[] = [input.agent_type];
  let paramIdx = 2;

  if (input.category) {
    conditions.push(`category = $${paramIdx++}`);
    params.push(input.category);
  }

  params.push(limit);

  const res = await pool.query(
    `SELECT content, category, times_applied, last_applied_at
     FROM agent_individual_learnings
     WHERE ${conditions.join(' AND ')}
     ORDER BY confidence DESC, created_at DESC
     LIMIT $${paramIdx}`,
    params,
  );

  return {
    learnings: res.rows.map((r: Record<string, unknown>) => ({
      content: r['content'] as string,
      category: r['category'] as string,
      times_applied: r['times_applied'] as number,
      last_applied_at: r['last_applied_at']
        ? (r['last_applied_at'] as Date).toISOString()
        : null,
    })),
  };
}
