/**
 * FEAT-ALG-011: Edge case handling (E1-E10)
 * Tests: TEST-ALG-017, TEST-ALG-018, TEST-ALG-019, TEST-ALG-020, TEST-ALG-021
 *
 * Pure-function tests — no DB required.
 */
import {
  handleE2Accuracy,
  shouldExcludeFromKpi,
  isKpiReliable,
  isColdStart,
  buildColdStartAdjustments,
} from '../../../src/workers/algorithm/edge-cases';

describe('FEAT-ALG-011: Edge case handling', () => {
  // ─── E2: handleE2Accuracy ────────────────────────────────

  // TEST-ALG-017: prediction_error = ABS(predicted - actual) / actual
  test('TEST-ALG-017: normal prediction error — ABS(10000-8000)/8000 = 0.25', () => {
    const error = handleE2Accuracy(10000, 8000);
    expect(error).toBeCloseTo(0.25, 2);
  });

  // TEST-ALG-018: predicted=0 AND actual=0 → accuracy = 1.0 (error = 0)
  test('TEST-ALG-018: E2 — predicted=0 AND actual=0 → error=0 (perfect)', () => {
    const error = handleE2Accuracy(0, 0);
    expect(error).toBe(0);
  });

  test('E2 — predicted>0, actual=0 → max error 1.0', () => {
    expect(handleE2Accuracy(500, 0)).toBe(1.0);
    expect(handleE2Accuracy(10000, 0)).toBe(1.0);
  });

  test('E2 — normal case ABS(predicted-actual)/actual', () => {
    // predicted=1000, actual=1200 → 200/1200
    expect(handleE2Accuracy(1000, 1200)).toBeCloseTo(200 / 1200, 5);
    // predicted=1000, actual=800 → 200/800
    expect(handleE2Accuracy(1000, 800)).toBeCloseTo(200 / 800, 5);
    // perfect prediction
    expect(handleE2Accuracy(1000, 1000)).toBe(0);
  });

  // ─── E3: shouldExcludeFromKpi ────────────────────────────

  // TEST-ALG-019: actual=NULL → exclude from KPI
  test('TEST-ALG-019: E3 — actual=NULL excluded from KPI', () => {
    expect(shouldExcludeFromKpi(null)).toBe(true);
  });

  test('E3 — actual=0 is NOT excluded (only NULL is excluded)', () => {
    expect(shouldExcludeFromKpi(0)).toBe(false);
  });

  test('E3 — actual has value → included in KPI', () => {
    expect(shouldExcludeFromKpi(1000)).toBe(false);
    expect(shouldExcludeFromKpi(1)).toBe(false);
  });

  test('E3 — handleE2Accuracy returns null for null actual', () => {
    // handleE2Accuracy returns null for null/undefined actual (E3 branch)
    expect(handleE2Accuracy(500, null as unknown as number)).toBeNull();
    expect(handleE2Accuracy(0, undefined as unknown as number)).toBeNull();
  });

  // ─── E5: isKpiReliable ───────────────────────────────────

  test('E5 — account_count < 5 → is_reliable=false', () => {
    expect(isKpiReliable(0)).toBe(false);
    expect(isKpiReliable(1)).toBe(false);
    expect(isKpiReliable(4)).toBe(false);
  });

  test('E5 — account_count >= 5 → is_reliable=true', () => {
    expect(isKpiReliable(5)).toBe(true);
    expect(isKpiReliable(10)).toBe(true);
    expect(isKpiReliable(100)).toBe(true);
  });

  // ─── E7: isColdStart ────────────────────────────────────

  // TEST-ALG-020: cold start — all factors zero
  test('TEST-ALG-020: E7 — all adjustments zero → cold start', () => {
    const adjustments: Record<string, { adjustment: number }> = {
      hook_type: { adjustment: 0 },
      content_length: { adjustment: 0 },
      post_hour: { adjustment: 0 },
      post_weekday: { adjustment: 0 },
      niche: { adjustment: 0 },
      narrative_structure: { adjustment: 0 },
      sound_bgm: { adjustment: 0 },
      hashtag_keyword: { adjustment: 0 },
      cross_account_performance: { adjustment: 0 },
    };
    expect(isColdStart(adjustments)).toBe(true);
  });

  test('E7 — empty adjustments → cold start', () => {
    expect(isColdStart({})).toBe(true);
  });

  test('E7 — any non-zero adjustment → NOT cold start', () => {
    const adjustments: Record<string, { adjustment: number }> = {
      hook_type: { adjustment: 0.15 },
      content_length: { adjustment: 0 },
      post_hour: { adjustment: 0 },
      post_weekday: { adjustment: 0 },
      niche: { adjustment: 0 },
      narrative_structure: { adjustment: 0 },
      sound_bgm: { adjustment: 0 },
      hashtag_keyword: { adjustment: 0 },
      cross_account_performance: { adjustment: 0 },
    };
    expect(isColdStart(adjustments)).toBe(false);
  });

  test('E7 — negative adjustment → NOT cold start', () => {
    const adjustments: Record<string, { adjustment: number }> = {
      hook_type: { adjustment: -0.1 },
    };
    expect(isColdStart(adjustments)).toBe(false);
  });

  // ─── E7: buildColdStartAdjustments ──────────────────────

  test('E7 — buildColdStartAdjustments produces correct structure', () => {
    const weights: Record<string, number> = {
      hook_type: 0.1111,
      content_length: 0.1111,
      post_hour: 0.1111,
    };

    const result = buildColdStartAdjustments(weights);

    // Each factor should have value='NULL', adjustment=0, weight=original
    expect(result['hook_type']).toEqual({ value: 'NULL', adjustment: 0, weight: 0.1111 });
    expect(result['content_length']).toEqual({ value: 'NULL', adjustment: 0, weight: 0.1111 });
    expect(result['post_hour']).toEqual({ value: 'NULL', adjustment: 0, weight: 0.1111 });

    // cold_start flag set
    expect(result['cold_start']).toBe('true');
  });

  test('E7 — buildColdStartAdjustments all 9 factors', () => {
    const weights: Record<string, number> = {
      hook_type: 0.1111,
      content_length: 0.1111,
      post_hour: 0.1111,
      post_weekday: 0.1111,
      niche: 0.1111,
      narrative_structure: 0.1111,
      sound_bgm: 0.1111,
      hashtag_keyword: 0.1111,
      cross_account_performance: 0.1111,
    };

    const result = buildColdStartAdjustments(weights);

    // 9 factors + cold_start = 10 keys
    const keys = Object.keys(result);
    expect(keys).toHaveLength(10);
    expect(keys).toContain('cold_start');

    // total_adjustment should be 0
    const totalAdj = Object.entries(result)
      .filter(([k]) => k !== 'cold_start')
      .reduce((sum, [, v]) => {
        if (typeof v === 'object' && v !== null && 'adjustment' in v) {
          return sum + (v as { adjustment: number }).adjustment;
        }
        return sum;
      }, 0);
    expect(totalAdj).toBe(0);
  });

  test('E7 — buildColdStartAdjustments preserves original weights', () => {
    const weights: Record<string, number> = {
      hook_type: 0.2,
      niche: 0.3,
    };

    const result = buildColdStartAdjustments(weights);
    expect((result['hook_type'] as { weight: number }).weight).toBe(0.2);
    expect((result['niche'] as { weight: number }).weight).toBe(0.3);
  });
});
