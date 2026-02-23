/**
 * MCI-025: get_human_responses
 * Tests: SELECT human_directives
 */
import { getHumanResponses } from '../../../src/mcp-server/tools/learning/get-human-responses';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-025: get_human_responses', () => {
  test('rejects invalid agent_type', async () => {
    await expect(
      getHumanResponses({ agent_type: 'invalid' as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns responses array', async () => {
    const result = await getHumanResponses({ agent_type: 'analyst' });
    expect(result).toHaveProperty('responses');
    expect(Array.isArray(result.responses)).toBe(true);
  });
});
