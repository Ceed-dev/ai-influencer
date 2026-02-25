/**
 * MCI-046: run_cumulative_analysis
 * Tests: cumulative analysis wrapper
 */
import { runCumulativeAnalysis } from '../../../src/mcp-server/tools/intelligence/run-cumulative-analysis';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-046: run_cumulative_analysis', () => {
  test('rejects empty content_id', async () => {
    await expect(
      runCumulativeAnalysis({ content_id: '' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns correct structure for valid content_id', async () => {
    // Even with non-existent content_id, the worker should return
    // a result (with empty similar items)
    const result = await runCumulativeAnalysis({ content_id: 'CNT_NONEXIST_999' });
    expect(result).toHaveProperty('structured');
    expect(result).toHaveProperty('ai_interpretation');
    expect(result).toHaveProperty('recommendations');
    expect(typeof result.structured).toBe('object');
    expect(typeof result.ai_interpretation).toBe('string');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});
