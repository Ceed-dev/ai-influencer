/**
 * MCI-014: save_tool_experience — INSERT into tool_experiences
 * Spec: 04-agent-design.md §4.5 #2
 */
import type {
  SaveToolExperienceInput,
  SaveToolExperienceOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';

export async function saveToolExperience(
  input: SaveToolExperienceInput,
): Promise<SaveToolExperienceOutput> {
  if (!input.tool_combination || input.tool_combination.length === 0) {
    throw new McpValidationError('tool_combination must have at least one tool');
  }
  if (input.quality_score < 0 || input.quality_score > 1) {
    throw new McpValidationError('quality_score must be between 0 and 1');
  }

  const pool = getPool();

  // Find the primary tool in tool_catalog
  const toolRes = await pool.query(
    `SELECT id FROM tool_catalog WHERE tool_name = $1 LIMIT 1`,
    [input.tool_combination[0]],
  );

  if (toolRes.rowCount === 0) {
    throw new McpNotFoundError(
      `Tool "${input.tool_combination[0]}" not found in tool_catalog`,
    );
  }

  const toolId = (toolRes.rows[0] as Record<string, unknown>)['id'] as number;

  const res = await pool.query(
    `INSERT INTO tool_experiences
       (tool_id, content_id, agent_id, recipe_used, quality_score, quality_notes, success, content_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      toolId,
      input.content_id,
      'tool_specialist',
      JSON.stringify({ tools: input.tool_combination }),
      input.quality_score,
      input.notes,
      true,
      input.character_type ?? null,
    ],
  );

  return { id: res.rows[0]['id'] as number };
}
