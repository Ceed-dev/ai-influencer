/**
 * TEST-MCP-038: update_prompt_suggestion_status — normal + not found + validation
 * FEAT-MCC-038
 */
import { updatePromptSuggestionStatus } from '@/src/mcp-server/tools/agent-mgmt/update-prompt-suggestion-status';
import { withClient } from '../../helpers/db';
import { McpValidationError, McpNotFoundError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-038: update_prompt_suggestion_status', () => {
  let suggestionId: number;

  beforeAll(async () => {
    const res = await withClient(async (client) => {
      return client.query(
        `INSERT INTO prompt_suggestions (agent_type, trigger_type, trigger_details, suggestion, status)
         VALUES ('strategist', 'score_decline', '{"score": 5}'::jsonb, 'MCP_TEST_Consider adjusting tone', 'pending')
         RETURNING id`,
      );
    });
    suggestionId = res.rows[0]?.id as number;
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(
        `DELETE FROM prompt_suggestions WHERE suggestion LIKE 'MCP_TEST_%'`,
      );
    });
  });

  test('TEST-MCP-038a: updates suggestion status to accepted', async () => {
    const result = await updatePromptSuggestionStatus({
      suggestion_id: suggestionId,
      status: 'accepted',
    });

    expect(result).toEqual({ success: true });

    const res = await withClient(async (client) => {
      return client.query(
        `SELECT status, resolved_at FROM prompt_suggestions WHERE id = $1`,
        [suggestionId],
      );
    });
    expect(res.rows[0]?.status).toBe('accepted');
    expect(res.rows[0]?.resolved_at).not.toBeNull();
  });

  test('TEST-MCP-038b: throws McpNotFoundError for non-existent suggestion', async () => {
    await expect(
      updatePromptSuggestionStatus({ suggestion_id: 999999, status: 'rejected' }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('TEST-MCP-038c: throws McpValidationError for invalid status', async () => {
    await expect(
      updatePromptSuggestionStatus({ suggestion_id: suggestionId, status: 'invalid' as 'accepted' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-038d: throws McpValidationError for invalid suggestion_id', async () => {
    await expect(
      updatePromptSuggestionStatus({ suggestion_id: -1, status: 'accepted' }),
    ).rejects.toThrow(McpValidationError);
  });
});
