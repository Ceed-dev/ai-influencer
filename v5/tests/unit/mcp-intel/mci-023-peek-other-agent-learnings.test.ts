/**
 * MCI-023: peek_other_agent_learnings
 * Tests: cross-agent lookup
 */
import { peekOtherAgentLearnings } from '../../../src/mcp-server/tools/learning/peek-other-agent-learnings';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-023: peek_other_agent_learnings', () => {
  test('rejects invalid target_agent_type', async () => {
    await expect(
      peekOtherAgentLearnings({ target_agent_type: 'invalid' as any, limit: 10 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns learnings with agent_type', async () => {
    const result = await peekOtherAgentLearnings({
      target_agent_type: 'researcher',
      limit: 5,
    });
    expect(result).toHaveProperty('learnings');
    expect(Array.isArray(result.learnings)).toBe(true);
  });
});
