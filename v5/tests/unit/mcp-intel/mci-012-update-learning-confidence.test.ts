/**
 * MCI-012: update_learning_confidence
 * Tests: UPDATE learnings.confidence
 */
import { updateLearningConfidence } from '../../../src/mcp-server/tools/intelligence/update-learning-confidence';
import { McpValidationError, McpNotFoundError } from '../../../src/mcp-server/errors';

describe('MCI-012: update_learning_confidence', () => {
  test('rejects confidence out of range', async () => {
    await expect(
      updateLearningConfidence({
        learning_id: 1,
        new_confidence: 1.5,
        additional_evidence: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty additional_evidence', async () => {
    await expect(
      updateLearningConfidence({
        learning_id: 1,
        new_confidence: 0.8,
        additional_evidence: '',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws not found for non-existent learning', async () => {
    await expect(
      updateLearningConfidence({
        learning_id: 999999,
        new_confidence: 0.8,
        additional_evidence: 'new evidence',
      }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
