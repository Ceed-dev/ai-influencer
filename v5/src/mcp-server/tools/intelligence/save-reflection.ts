/**
 * MCI-020: save_reflection — INSERT into agent_reflections
 * Spec: 04-agent-design.md §4.12 #1
 */
import type {
  SaveReflectionInput,
  SaveReflectionOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_AGENT_TYPES = [
  'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator',
] as const;

export async function saveReflection(
  input: SaveReflectionInput,
): Promise<SaveReflectionOutput> {
  if (!VALID_AGENT_TYPES.includes(input.agent_type as typeof VALID_AGENT_TYPES[number])) {
    throw new McpValidationError(
      `Invalid agent_type: "${input.agent_type}". Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
    );
  }
  if (input.self_score < 1 || input.self_score > 10) {
    throw new McpValidationError('self_score must be between 1 and 10');
  }
  if (!input.task_description || input.task_description.trim().length === 0) {
    throw new McpValidationError('task_description is required');
  }
  if (!input.score_reasoning || input.score_reasoning.trim().length === 0) {
    throw new McpValidationError('score_reasoning is required');
  }

  const pool = getPool();

  const res = await pool.query(
    `INSERT INTO agent_reflections
       (agent_type, cycle_id, task_description, self_score, score_reasoning,
        what_went_well, what_to_improve, next_actions, metrics_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      input.agent_type,
      input.cycle_id,
      input.task_description,
      input.self_score,
      input.score_reasoning,
      Array.isArray(input.what_went_well) ? input.what_went_well : [input.what_went_well],
      Array.isArray(input.what_to_improve) ? input.what_to_improve : [input.what_to_improve],
      input.next_actions,
      input.metrics_snapshot ? JSON.stringify(input.metrics_snapshot) : null,
    ],
  );

  return { id: res.rows[0]['id'] as number };
}
