/**
 * Tests for FEAT-INT-016: Recipe failure threshold
 */
import { exceedsFailureThreshold } from '@/src/agents/intelligence/recipe-failure';

describe('INT-016: Recipe failure threshold', () => {
  test('exceeds threshold when failure rate > threshold', () => {
    // success_rate = 0.6, failure_rate = 0.4, threshold = 0.3
    expect(exceedsFailureThreshold(0.6, 0.3)).toBe(true);
  });

  test('does not exceed when failure rate < threshold', () => {
    // success_rate = 0.8, failure_rate = 0.2, threshold = 0.3
    expect(exceedsFailureThreshold(0.8, 0.3)).toBe(false);
  });

  test('does not exceed when failure rate = threshold', () => {
    // success_rate = 0.7, failure_rate = 0.3, threshold = 0.3
    expect(exceedsFailureThreshold(0.7, 0.3)).toBe(false);
  });

  test('returns false for null success rate (no data)', () => {
    expect(exceedsFailureThreshold(null, 0.3)).toBe(false);
  });

  test('exceeds at zero success rate', () => {
    expect(exceedsFailureThreshold(0, 0.3)).toBe(true);
  });

  test('does not exceed at 100% success rate', () => {
    expect(exceedsFailureThreshold(1.0, 0.3)).toBe(false);
  });
});
