/**
 * Tests for FEAT-MS-002: Metrics insertion
 */
import { calculateEngagementRate } from '@/src/workers/measurement/metrics-inserter';

describe('MS-002: Metrics inserter', () => {
  test('calculates engagement rate correctly', () => {
    const rate = calculateEngagementRate(1000, 50, 10, 5, 3);
    // (50 + 10 + 5 + 3) / 1000 = 0.068
    expect(rate).toBeCloseTo(0.068);
  });

  test('returns null for zero views', () => {
    expect(calculateEngagementRate(0, 10, 5, 2)).toBeNull();
  });

  test('returns null for null views', () => {
    expect(calculateEngagementRate(null, 10, 5, 2)).toBeNull();
  });

  test('handles null individual metrics', () => {
    const rate = calculateEngagementRate(1000, null, null, null, null);
    expect(rate).toBe(0);
  });

  test('excludes saves from calculation when undefined', () => {
    const rate = calculateEngagementRate(1000, 50, 10, 5);
    // (50 + 10 + 5 + 0) / 1000 = 0.065
    expect(rate).toBeCloseTo(0.065);
  });

  test('engagement rate is between 0 and 1 for normal data', () => {
    const rate = calculateEngagementRate(10000, 200, 50, 30, 10);
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(1);
  });
});
