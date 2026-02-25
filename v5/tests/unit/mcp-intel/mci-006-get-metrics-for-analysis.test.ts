/**
 * MCI-006: get_metrics_for_analysis
 * Tests: metric retrieval with since filter
 */
import { getMetricsForAnalysis } from '../../../src/mcp-server/tools/intelligence/get-metrics-for-analysis';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-006: get_metrics_for_analysis', () => {
  test('rejects invalid since value', async () => {
    await expect(
      getMetricsForAnalysis({ since: '30d' as any, status: 'measured' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects non-measured status', async () => {
    await expect(
      getMetricsForAnalysis({ since: '24h', status: 'posted' as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns metrics array', async () => {
    const result = await getMetricsForAnalysis({ since: '7d', status: 'measured' });
    expect(result).toHaveProperty('metrics');
    expect(Array.isArray(result.metrics)).toBe(true);
  });
});
