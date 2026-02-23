/**
 * MCI-009: detect_anomalies
 * Tests: statistical anomaly detection
 */
import { detectAnomalies } from '../../../src/mcp-server/tools/intelligence/detect-anomalies';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-009: detect_anomalies', () => {
  test('rejects invalid period', async () => {
    await expect(
      detectAnomalies({ period: '90d' as any, threshold: 2.0 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects non-positive threshold', async () => {
    await expect(
      detectAnomalies({ period: '7d', threshold: 0 }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns anomalies array', async () => {
    const result = await detectAnomalies({ period: '7d', threshold: 2.0 });
    expect(result).toHaveProperty('anomalies');
    expect(Array.isArray(result.anomalies)).toBe(true);
  });
});
