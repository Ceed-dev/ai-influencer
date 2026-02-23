/**
 * MCI-024: submit_agent_message
 * Tests: INSERT into agent_communications
 */
import { submitAgentMessage } from '../../../src/mcp-server/tools/learning/submit-agent-message';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM agent_communications WHERE content LIKE 'test_mci_024%'`);
  });
}

describe('MCI-024: submit_agent_message', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  test('rejects invalid agent_type', async () => {
    await expect(
      submitAgentMessage({
        agent_type: 'invalid' as any,
        message_type: 'proposal',
        content: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects invalid message_type', async () => {
    await expect(
      submitAgentMessage({
        agent_type: 'analyst',
        message_type: 'invalid' as any,
        content: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('inserts message and returns id', async () => {
    const result = await submitAgentMessage({
      agent_type: 'analyst',
      message_type: 'proposal',
      content: 'test_mci_024 proposal',
    });
    expect(result).toHaveProperty('id');
    expect(typeof result.id).toBe('number');
  });
});
