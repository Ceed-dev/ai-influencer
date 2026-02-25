/**
 * FEAT-MCC-039: submit_learning_guidance
 * Spec: 04-agent-design.md S4.9 #6
 * Inserts a learning guidance directive for a target agent.
 */
import type {
  SubmitLearningGuidanceInput,
  SubmitLearningGuidanceOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpDbError } from '../../errors';

const VALID_AGENT_TYPES = [
  'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator',
] as const;

export async function submitLearningGuidance(
  input: SubmitLearningGuidanceInput,
): Promise<SubmitLearningGuidanceOutput> {
  if (!VALID_AGENT_TYPES.includes(input.target_agent_type as typeof VALID_AGENT_TYPES[number])) {
    throw new McpValidationError(
      `Invalid target_agent_type: "${input.target_agent_type}". Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
    );
  }
  if (!input.guidance || input.guidance.trim().length === 0) {
    throw new McpValidationError('guidance is required and must be non-empty');
  }
  if (!input.category || input.category.trim().length === 0) {
    throw new McpValidationError('category is required and must be non-empty');
  }

  const pool = getPool();

  // Build the content as structured JSON including category
  const content = JSON.stringify({
    guidance: input.guidance,
    category: input.category,
  });

  const res = await pool.query(
    `INSERT INTO human_directives (directive_type, content, target_agents, priority, status)
     VALUES ('learning_guidance', $1, $2, 'normal', 'pending')
     RETURNING id`,
    [content, [input.target_agent_type]],
  );

  const row = res.rows[0] as { id: number } | undefined;
  if (!row) {
    throw new McpDbError('Failed to insert learning guidance directive');
  }

  return { id: row.id };
}
