/**
 * Tests for FEAT-INT-007: Auto-promote learnings
 */
import { isEligibleForPromotion } from '@/src/agents/intelligence/auto-promote';

describe('INT-007: Auto-promote learnings', () => {
  test('eligible when confidence and times_applied meet thresholds', () => {
    expect(isEligibleForPromotion(0.85, 5, 0.8, 3)).toBe(true);
  });

  test('not eligible when confidence below threshold', () => {
    expect(isEligibleForPromotion(0.7, 5, 0.8, 3)).toBe(false);
  });

  test('not eligible when times_applied below minimum', () => {
    expect(isEligibleForPromotion(0.9, 2, 0.8, 3)).toBe(false);
  });

  test('eligible at exact threshold values', () => {
    expect(isEligibleForPromotion(0.8, 3, 0.8, 3)).toBe(true);
  });

  test('not eligible when both below thresholds', () => {
    expect(isEligibleForPromotion(0.5, 1, 0.8, 3)).toBe(false);
  });
});
