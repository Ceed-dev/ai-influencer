/**
 * FEAT-MCC-042: rollback_agent_prompt
 * Spec: 04-agent-design.md S4.9 #9
 * Rolls back agent prompt to a specified version, deactivating the current active version.
 */
import type {
  RollbackAgentPromptInput,
  RollbackAgentPromptOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError, McpDbError } from '../../errors';

const VALID_AGENT_TYPES = [
  'strategist', 'researcher', 'analyst', 'planner', 'tool_specialist', 'data_curator',
] as const;

export async function rollbackAgentPrompt(
  input: RollbackAgentPromptInput,
): Promise<RollbackAgentPromptOutput> {
  if (!VALID_AGENT_TYPES.includes(input.agent_type as typeof VALID_AGENT_TYPES[number])) {
    throw new McpValidationError(
      `Invalid agent_type: "${input.agent_type}". Must be one of: ${VALID_AGENT_TYPES.join(', ')}`,
    );
  }
  if (typeof input.version !== 'number' || input.version < 1) {
    throw new McpValidationError('version must be a positive integer');
  }

  const pool = getPool();

  // Check the target version exists
  const targetRes = await pool.query(
    `SELECT id FROM agent_prompt_versions
     WHERE agent_type = $1 AND version = $2`,
    [input.agent_type, input.version],
  );
  if (targetRes.rowCount === 0) {
    throw new McpNotFoundError(
      `Prompt version ${input.version} for agent "${input.agent_type}" not found`,
    );
  }

  // Use a transaction to deactivate current and activate target
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Deactivate all current active versions for this agent
    await client.query(
      `UPDATE agent_prompt_versions SET active = false
       WHERE agent_type = $1 AND active = true`,
      [input.agent_type],
    );

    // Activate the target version
    const updateRes = await client.query(
      `UPDATE agent_prompt_versions SET active = true
       WHERE agent_type = $1 AND version = $2
       RETURNING id`,
      [input.agent_type, input.version],
    );

    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      throw new McpDbError('Failed to activate target version');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof McpDbError || err instanceof McpNotFoundError) {
      throw err;
    }
    throw new McpDbError('Failed to rollback agent prompt', err);
  } finally {
    client.release();
  }

  return { success: true };
}
