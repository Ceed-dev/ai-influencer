/**
 * Tests for rollback_agent_prompt
 */
import { rollbackAgentPrompt } from '@/src/mcp-server/tools/dashboard/rollback-agent-prompt';
import { McpValidationError, McpNotFoundError } from '@/src/mcp-server/errors';
import { withClient, query } from '../../helpers/db';

const MARKER = 'TRBK_';

describe('rollback_agent_prompt', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_prompt_versions WHERE change_summary LIKE '${MARKER}%'`);
      // Insert two versions for strategist
      await client.query(`
        INSERT INTO agent_prompt_versions (agent_type, version, prompt_content, change_summary, active)
        VALUES
          ('strategist', 9001, 'Old prompt v1', '${MARKER}v1', false),
          ('strategist', 9002, 'Current prompt v2', '${MARKER}v2', true)
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM agent_prompt_versions WHERE change_summary LIKE '${MARKER}%'`);
    });
  });

  test('rolls back to a previous version successfully', async () => {
    const result = await rollbackAgentPrompt({
      agent_type: 'strategist',
      version: 9001,
    });
    expect(result).toEqual({ success: true });

    // Verify: v9001 is now active, v9002 is not
    const v1Res = await query(
      `SELECT active FROM agent_prompt_versions WHERE agent_type = 'strategist' AND version = 9001`
    );
    const v2Res = await query(
      `SELECT active FROM agent_prompt_versions WHERE agent_type = 'strategist' AND version = 9002`
    );
    expect(v1Res.rows[0].active).toBe(true);
    expect(v2Res.rows[0].active).toBe(false);
  });

  test('rejects invalid agent_type', async () => {
    await expect(
      rollbackAgentPrompt({ agent_type: 'invalid' as any, version: 1 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects invalid version', async () => {
    await expect(
      rollbackAgentPrompt({ agent_type: 'strategist', version: 0 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws NotFoundError for nonexistent version', async () => {
    await expect(
      rollbackAgentPrompt({ agent_type: 'strategist', version: 99999 }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
