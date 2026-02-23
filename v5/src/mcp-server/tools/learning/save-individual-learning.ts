/**
 * MCI-021: save_individual_learning — validate 17 categories
 * Spec: 04-agent-design.md §4.12 #3
 */
import type {
  SaveIndividualLearningInput,
  SaveIndividualLearningOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

const VALID_AGENT_TYPES = [
  'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator',
] as const;

const VALID_CATEGORIES = [
  'data_source', 'technique', 'pattern', 'mistake', 'insight',
  'tool_characteristics', 'tool_combination', 'tool_failure_pattern', 'tool_update',
  'data_classification', 'curation_quality', 'source_reliability',
  'content', 'timing', 'audience', 'platform', 'niche',
] as const;

export async function saveIndividualLearning(
  input: SaveIndividualLearningInput,
): Promise<SaveIndividualLearningOutput> {
  if (!VALID_AGENT_TYPES.includes(input.agent_type as typeof VALID_AGENT_TYPES[number])) {
    throw new McpValidationError(
      `Invalid agent_type: "${input.agent_type}". Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
    );
  }
  if (!VALID_CATEGORIES.includes(input.category as typeof VALID_CATEGORIES[number])) {
    throw new McpValidationError(
      `Invalid category: "${input.category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
    );
  }
  if (!input.content || input.content.trim().length === 0) {
    throw new McpValidationError('content is required');
  }

  const confidence = input.confidence ?? 0.5;
  if (confidence < 0 || confidence > 1) {
    throw new McpValidationError('confidence must be between 0 and 1');
  }

  const pool = getPool();

  const res = await pool.query(
    `INSERT INTO agent_individual_learnings
       (agent_type, category, content, context, confidence)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      input.agent_type,
      input.category,
      input.content,
      input.context ?? null,
      confidence,
    ],
  );

  return { id: res.rows[0]['id'] as number };
}
