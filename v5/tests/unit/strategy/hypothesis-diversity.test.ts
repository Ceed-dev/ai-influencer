/**
 * Tests for FEAT-STR-007: Hypothesis diversity
 */
import {
  calculateConcentration,
  ALL_HYPOTHESIS_CATEGORIES,
} from '@/src/agents/strategy/hypothesis-diversity';

describe('STR-007: Hypothesis diversity', () => {
  test('calculates concentration correctly', () => {
    const stats = calculateConcentration(['timing', 'timing', 'niche']);
    expect(stats[0]!.category).toBe('timing');
    expect(stats[0]!.proportion).toBeCloseTo(2 / 3);
    expect(stats[1]!.category).toBe('niche');
    expect(stats[1]!.proportion).toBeCloseTo(1 / 3);
  });

  test('returns empty for empty input', () => {
    expect(calculateConcentration([])).toEqual([]);
  });

  test('single category has 100% concentration', () => {
    const stats = calculateConcentration(['timing', 'timing']);
    expect(stats[0]!.proportion).toBe(1);
  });

  test('ALL_HYPOTHESIS_CATEGORIES has 5 categories', () => {
    expect(ALL_HYPOTHESIS_CATEGORIES.length).toBe(5);
    expect(ALL_HYPOTHESIS_CATEGORIES).toContain('content_format');
    expect(ALL_HYPOTHESIS_CATEGORIES).toContain('timing');
    expect(ALL_HYPOTHESIS_CATEGORIES).toContain('niche');
    expect(ALL_HYPOTHESIS_CATEGORIES).toContain('audience');
    expect(ALL_HYPOTHESIS_CATEGORIES).toContain('platform_specific');
  });
});
