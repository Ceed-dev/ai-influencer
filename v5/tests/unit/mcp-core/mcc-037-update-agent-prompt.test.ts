/**
 * TEST-MCP-037: update_agent_prompt — normal + validation
 * FEAT-MCC-037
 */
import { updateAgentPrompt } from '@/src/mcp-server/tools/agent-mgmt/update-agent-prompt';
import { withClient } from '../../helpers/db';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-037: update_agent_prompt', () => {
  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(
        `DELETE FROM agent_prompt_versions WHERE prompt_content LIKE 'MCP_TEST_%'`,
      );
    });
  });

  test('TEST-MCP-037a: inserts new prompt version and returns version_id', async () => {
    const result = await updateAgentPrompt({
      agent_type: 'strategist',
      prompt_content: 'MCP_TEST_You are a strategist agent v2',
      change_reason: 'Test update for mcc-037',
    });

    expect(typeof result.version_id).toBe('number');
    expect(result.version_id).toBeGreaterThanOrEqual(1);

    // Verify insertion
    const res = await withClient(async (client) => {
      return client.query(
        `SELECT agent_type, active, prompt_content FROM agent_prompt_versions
         WHERE prompt_content = 'MCP_TEST_You are a strategist agent v2'`,
      );
    });
    expect(res.rows[0]?.agent_type).toBe('strategist');
    expect(res.rows[0]?.active).toBe(true);
  });

  test('TEST-MCP-037b: deactivates previous version', async () => {
    // Insert second version
    const result = await updateAgentPrompt({
      agent_type: 'strategist',
      prompt_content: 'MCP_TEST_You are a strategist agent v3',
      change_reason: 'Test update v3',
    });

    expect(result.version_id).toBeGreaterThanOrEqual(2);

    // Verify previous version is deactivated
    const res = await withClient(async (client) => {
      return client.query(
        `SELECT COUNT(*)::int AS active_count FROM agent_prompt_versions
         WHERE agent_type = 'strategist' AND active = true AND prompt_content LIKE 'MCP_TEST_%'`,
      );
    });
    expect(res.rows[0]?.active_count).toBe(1);
  });

  test('TEST-MCP-037c: throws McpValidationError for invalid agent_type', async () => {
    await expect(
      updateAgentPrompt({
        agent_type: 'invalid_agent' as 'strategist',
        prompt_content: 'test',
        change_reason: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-037d: throws McpValidationError for empty prompt_content', async () => {
    await expect(
      updateAgentPrompt({
        agent_type: 'strategist',
        prompt_content: '',
        change_reason: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
