/**
 * FEAT-MCC-037: update_agent_prompt
 * Spec: 04-agent-design.md §4.9 #8
 * Inserts a new version into agent_prompt_versions and deactivates old versions.
 */
import type {
  UpdateAgentPromptInput,
  UpdateAgentPromptOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpDbError } from '../../errors';

const VALID_AGENT_TYPES = [
  'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator',
] as const;

export async function updateAgentPrompt(
  input: UpdateAgentPromptInput,
): Promise<UpdateAgentPromptOutput> {
  if (!input.agent_type || !VALID_AGENT_TYPES.includes(input.agent_type as typeof VALID_AGENT_TYPES[number])) {
    throw new McpValidationError(
      `Invalid agent_type: "${String(input.agent_type)}". Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
    );
  }
  if (!input.prompt_content || input.prompt_content.trim() === '') {
    throw new McpValidationError('prompt_content is required and must be non-empty');
  }
  if (!input.change_reason || input.change_reason.trim() === '') {
    throw new McpValidationError('change_reason is required and must be non-empty');
  }

  const pool = getPool();

  // Get the next version number
  const versionRes = await pool.query(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
     FROM agent_prompt_versions
     WHERE agent_type = $1`,
    [input.agent_type],
  );

  const versionRow = versionRes.rows[0] as { next_version: number } | undefined;
  const nextVersion = versionRow?.next_version ?? 1;

  // Deactivate existing active versions for this agent
  await pool.query(
    `UPDATE agent_prompt_versions
     SET active = false
     WHERE agent_type = $1 AND active = true`,
    [input.agent_type],
  );

  // Insert new version
  const insertRes = await pool.query(
    `INSERT INTO agent_prompt_versions (agent_type, version, prompt_content, change_summary, changed_by, active)
     VALUES ($1, $2, $3, $4, 'human', true)
     RETURNING id`,
    [input.agent_type, nextVersion, input.prompt_content, input.change_reason],
  );

  const row = insertRes.rows[0] as { id: string } | undefined;
  if (!row) {
    throw new McpDbError('Failed to insert agent prompt version');
  }

  return { version_id: nextVersion };
}
