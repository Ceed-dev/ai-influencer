/**
 * MCI-026: mark_learning_applied
 * Tests: UPDATE applied status
 */
import { markLearningApplied } from '../../../src/mcp-server/tools/learning/mark-learning-applied';
import { McpNotFoundError } from '../../../src/mcp-server/errors';

describe('MCI-026: mark_learning_applied', () => {
  test('throws not found for non-existent learning', async () => {
    await expect(
      markLearningApplied({ learning_id: 999999 }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
