/**
 * MCI-045: run_kpi_snapshot
 * Tests: KPI snapshot monthly generation wrapper
 */
import { runKpiSnapshot } from '../../../src/mcp-server/tools/intelligence/run-kpi-snapshot';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-045: run_kpi_snapshot', () => {
  test('rejects invalid year_month format', async () => {
    await expect(
      runKpiSnapshot({ year_month: '2026' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects month out of range', async () => {
    await expect(
      runKpiSnapshot({ year_month: '2026-13' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty year_month', async () => {
    await expect(
      runKpiSnapshot({ year_month: '' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns correct structure for valid year_month', async () => {
    const result = await runKpiSnapshot({ year_month: '2026-01' });
    expect(result).toHaveProperty('platforms');
    expect(Array.isArray(result.platforms)).toBe(true);

    for (const p of result.platforms) {
      expect(p).toHaveProperty('platform');
      expect(p).toHaveProperty('achievement_rate');
      expect(p).toHaveProperty('prediction_accuracy');
      expect(p).toHaveProperty('is_reliable');
      expect(['youtube', 'tiktok', 'instagram', 'x']).toContain(p.platform);
      expect(typeof p.achievement_rate).toBe('number');
      expect(typeof p.is_reliable).toBe('boolean');
    }
  });
});
