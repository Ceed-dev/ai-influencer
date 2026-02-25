/**
 * MCI-034: get_content_prediction
 * Tests: hypothesis predicted_kpis retrieval
 */
import { getContentPrediction } from '../../../src/mcp-server/tools/intelligence/get-content-prediction';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-034: get_content_prediction', () => {
  test('rejects empty content_id', async () => {
    await expect(
      getContentPrediction({ content_id: '' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns null fields for non-existent content', async () => {
    const result = await getContentPrediction({ content_id: 'CNT_NONEXIST_0001' });
    expect(result.content_id).toBe('CNT_NONEXIST_0001');
    expect(result.hypothesis_id).toBeNull();
    expect(result.predicted_kpis).toBeNull();
    expect(result.baseline_used).toBeNull();
  });
});
