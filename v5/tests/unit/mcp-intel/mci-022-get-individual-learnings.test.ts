/**
 * MCI-022: get_individual_learnings
 * Tests: filter by agent_type
 */
import { getIndividualLearnings } from '../../../src/mcp-server/tools/learning/get-individual-learnings';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-022: get_individual_learnings', () => {
  test('rejects invalid agent_type', async () => {
    await expect(
      getIndividualLearnings({ agent_type: 'invalid' as any, limit: 10 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns learnings array', async () => {
    const result = await getIndividualLearnings({ agent_type: 'analyst', limit: 5 });
    expect(result).toHaveProperty('learnings');
    expect(Array.isArray(result.learnings)).toBe(true);
  });
});
