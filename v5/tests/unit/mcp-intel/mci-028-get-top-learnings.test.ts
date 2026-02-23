/**
 * MCI-028: get_top_learnings
 * Tests: top N by confidence
 */
import { getTopLearnings } from '../../../src/mcp-server/tools/learning/get-top-learnings';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-028: get_top_learnings', () => {
  test('rejects limit out of range', async () => {
    await expect(
      getTopLearnings({ limit: 200, min_confidence: 0.7 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects min_confidence out of range', async () => {
    await expect(
      getTopLearnings({ limit: 10, min_confidence: 1.5 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns learnings array', async () => {
    const result = await getTopLearnings({ limit: 5, min_confidence: 0.5 });
    expect(result).toHaveProperty('learnings');
    expect(Array.isArray(result.learnings)).toBe(true);
  });
});
