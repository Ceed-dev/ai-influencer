/**
 * MCI-023: peek_other_agent_learnings — cross-agent lookup
 * Spec: 04-agent-design.md §4.12 #5
 */
import type {
  PeekOtherAgentLearningsInput,
  PeekOtherAgentLearningsOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';
import type { AgentType } from '@/types/database';

const VALID_AGENT_TYPES = [
  'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator',
] as const;

export async function peekOtherAgentLearnings(
  input: PeekOtherAgentLearningsInput,
): Promise<PeekOtherAgentLearningsOutput> {
  if (!VALID_AGENT_TYPES.includes(input.target_agent_type as typeof VALID_AGENT_TYPES[number])) {
    throw new McpValidationError(
      `Invalid target_agent_type: "${input.target_agent_type}". Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
    );
  }

  const limit = input.limit ?? 10;
  const pool = getPool();

  const conditions: string[] = ['agent_type = $1', 'is_active = true'];
  const params: unknown[] = [input.target_agent_type];
  let paramIdx = 2;

  if (input.category) {
    conditions.push(`category = $${paramIdx++}`);
    params.push(input.category);
  }

  params.push(limit);

  const res = await pool.query(
    `SELECT content, category, agent_type
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
      agent_type: r['agent_type'] as AgentType,
    })),
  };
}
