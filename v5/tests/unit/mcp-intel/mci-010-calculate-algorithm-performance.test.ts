/**
 * MCI-010: calculate_algorithm_performance
 * Tests: algorithm accuracy calculation
 */
import { calculateAlgorithmPerformance } from '../../../src/mcp-server/tools/intelligence/calculate-algorithm-performance';
import { McpValidationError } from '../../../src/mcp-server/errors';
import { withClient } from '../../helpers/db';

async function cleanup() {
  await withClient(async (client) => {
    await client.query(`DELETE FROM algorithm_performance WHERE period = 'daily' AND measured_at > NOW() - INTERVAL '1 minute'`);
  });
}

describe('MCI-010: calculate_algorithm_performance', () => {
  afterAll(cleanup);

  test('rejects invalid period', async () => {
    await expect(
      calculateAlgorithmPerformance({ period: 'monthly' as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns performance metrics', async () => {
    const result = await calculateAlgorithmPerformance({ period: 'daily' });
    expect(result).toHaveProperty('hypothesis_accuracy');
    expect(result).toHaveProperty('prediction_error');
    expect(result).toHaveProperty('learning_count');
    expect(result).toHaveProperty('improvement_rate');
    expect(typeof result.hypothesis_accuracy).toBe('number');
  });
});
