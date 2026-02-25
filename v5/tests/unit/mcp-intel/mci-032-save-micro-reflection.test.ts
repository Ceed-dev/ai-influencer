/**
 * MCI-032: save_micro_reflection
 * Tests: UPDATE content_learnings with reflection data
 */
import { saveMicroReflection } from '../../../src/mcp-server/tools/intelligence/save-micro-reflection';
import { McpValidationError, McpNotFoundError } from '../../../src/mcp-server/errors';

describe('MCI-032: save_micro_reflection', () => {
  test('rejects empty content_learning_id', async () => {
    await expect(
      saveMicroReflection({
        content_learning_id: '',
        what_worked: ['test'],
        what_didnt_work: ['test'],
        key_insight: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty key_insight', async () => {
    await expect(
      saveMicroReflection({
        content_learning_id: '00000000-0000-0000-0000-000000000000',
        what_worked: ['test'],
        what_didnt_work: ['test'],
        key_insight: '',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws not found for non-existent content_learning', async () => {
    await expect(
      saveMicroReflection({
        content_learning_id: '00000000-0000-0000-0000-000000000000',
        what_worked: ['good hook'],
        what_didnt_work: ['bad cta'],
        key_insight: 'hooks matter more',
      }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
