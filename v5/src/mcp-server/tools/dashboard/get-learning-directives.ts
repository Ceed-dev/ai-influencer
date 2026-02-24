/**
 * FEAT-MCC-040: get_learning_directives
 * Spec: 04-agent-design.md S4.9 #7
 * Returns learning guidance directives for a specific agent type.
 */
import type {
  GetLearningDirectivesInput,
  GetLearningDirectivesOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_AGENT_TYPES = [
  'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator',
] as const;

export async function getLearningDirectives(
  input: GetLearningDirectivesInput,
): Promise<GetLearningDirectivesOutput> {
  if (!VALID_AGENT_TYPES.includes(input.agent_type as typeof VALID_AGENT_TYPES[number])) {
    throw new McpValidationError(
      `Invalid agent_type: "${input.agent_type}". Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
    );
  }

  const pool = getPool();

  const res = await pool.query(
    `SELECT content, created_at
     FROM human_directives
     WHERE directive_type = 'learning_guidance'
       AND $1 = ANY(target_agents)
     ORDER BY created_at DESC`,
    [input.agent_type],
  );

  return {
    directives: res.rows.map((r: Record<string, unknown>) => {
      const rawContent = r['content'] as string;
      let guidance = rawContent;
      let category = 'general';

      // Parse structured JSON content
      try {
        const parsed = JSON.parse(rawContent) as Record<string, unknown>;
        guidance = (parsed['guidance'] as string) ?? rawContent;
        category = (parsed['category'] as string) ?? 'general';
      } catch {
        // Content is plain text, use as-is
      }

      return {
        guidance,
        category,
        created_at: (r['created_at'] as Date).toISOString(),
      };
    }),
  };
}
