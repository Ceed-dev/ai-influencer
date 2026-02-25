/**
 * MCI-019: submit_for_human_review
 * Tests: UPDATE review_status
 */
import { submitForHumanReview } from '../../../src/mcp-server/tools/curation/submit-for-human-review';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-019: submit_for_human_review', () => {
  test('rejects empty component_ids', async () => {
    await expect(
      submitForHumanReview({ component_ids: [], summary: 'test' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty summary', async () => {
    await expect(
      submitForHumanReview({ component_ids: ['SCN_0001'], summary: '' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns success for valid input', async () => {
    const result = await submitForHumanReview({
      component_ids: ['SCN_9999'],
      summary: 'Test review',
    });
    expect(result).toEqual({ success: true });
  });
});
