/**
 * MCI-033: get_content_metrics
 * Tests: publications->metrics retrieval
 */
import { getContentMetrics } from '../../../src/mcp-server/tools/intelligence/get-content-metrics';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-033: get_content_metrics', () => {
  test('rejects empty content_id', async () => {
    await expect(
      getContentMetrics({ content_id: '' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns empty publications for non-existent content', async () => {
    const result = await getContentMetrics({ content_id: 'CNT_NONEXIST_0001' });
    expect(result).toHaveProperty('content_id', 'CNT_NONEXIST_0001');
    expect(result).toHaveProperty('publications');
    expect(result.publications).toHaveLength(0);
    expect(result).toHaveProperty('aggregated_kpis');
  });
});
