/**
 * MCC-044: get_algorithm_performance
 * Tests: algorithm performance trend retrieval for strategy agent
 */
import { getAlgorithmPerformance } from '../../../src/mcp-server/tools/strategy/get-algorithm-performance';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCC-044: get_algorithm_performance', () => {
  test('rejects invalid period', async () => {
    await expect(
      getAlgorithmPerformance({ period: 'monthly' as any, limit: 12 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects invalid limit (zero)', async () => {
    await expect(
      getAlgorithmPerformance({ period: 'weekly', limit: 0 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects limit above 100', async () => {
    await expect(
      getAlgorithmPerformance({ period: 'weekly', limit: 101 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns data array with required fields', async () => {
    const result = await getAlgorithmPerformance({ period: 'weekly', limit: 12 });
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);

    for (const entry of result.data) {
      expect(entry).toHaveProperty('measured_at');
      expect(entry).toHaveProperty('hypothesis_accuracy');
      expect(entry).toHaveProperty('prediction_error');
      expect(entry).toHaveProperty('improvement_rate');
      expect(typeof entry.measured_at).toBe('string');
      expect(typeof entry.hypothesis_accuracy).toBe('number');
      expect(typeof entry.prediction_error).toBe('number');
      expect(typeof entry.improvement_rate).toBe('number');
    }
  });

  test('respects limit parameter', async () => {
    const result = await getAlgorithmPerformance({ period: 'daily', limit: 1 });
    expect(result.data.length).toBeLessThanOrEqual(1);
  });

  test('accepts daily period', async () => {
    const result = await getAlgorithmPerformance({ period: 'daily', limit: 5 });
    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);
  });
});
