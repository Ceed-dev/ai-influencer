/**
 * MCI-035: get_daily_micro_analyses_summary
 * Tests: daily aggregation of micro analyses
 */
import { getDailyMicroAnalysesSummary } from '../../../src/mcp-server/tools/intelligence/get-daily-micro-analyses-summary';

describe('MCI-035: get_daily_micro_analyses_summary', () => {
  test('returns summary for today', async () => {
    const result = await getDailyMicroAnalysesSummary({});
    expect(result).toHaveProperty('date');
    expect(result).toHaveProperty('total_analyses');
    expect(result).toHaveProperty('confirmed');
    expect(result).toHaveProperty('inconclusive');
    expect(result).toHaveProperty('rejected');
    expect(result).toHaveProperty('avg_prediction_error');
    expect(result).toHaveProperty('top_insights');
    expect(result).toHaveProperty('promoted_count');
    expect(typeof result.total_analyses).toBe('number');
  });

  test('returns summary for specific date', async () => {
    const result = await getDailyMicroAnalysesSummary({ date: '2026-01-01' });
    expect(result.date).toBe('2026-01-01');
    expect(result.total_analyses).toBeGreaterThanOrEqual(0);
  });

  test('supports niche filter', async () => {
    const result = await getDailyMicroAnalysesSummary({ niche: 'beauty' });
    expect(result).toHaveProperty('total_analyses');
    expect(Array.isArray(result.top_insights)).toBe(true);
  });
});
