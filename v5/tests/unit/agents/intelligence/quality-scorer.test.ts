/**
 * Tests for FEAT-INT-010: Quality scorer
 */
import {
  calculateWeightedScore,
  scoreQuality,
  DEFAULT_QUALITY_WEIGHTS,
} from '@/src/agents/intelligence/quality-scorer';
import type { QualityDimension } from '@/src/agents/intelligence/quality-scorer';

describe('INT-010: Quality scorer', () => {
  test('perfect score of 10.0 when all dimensions are 10', () => {
    const dimensions: QualityDimension[] = [
      { name: 'visual', score: 10, weight: 0.5 },
      { name: 'audio', score: 10, weight: 0.5 },
    ];
    expect(calculateWeightedScore(dimensions)).toBe(10);
  });

  test('weighted average is correct', () => {
    const dimensions: QualityDimension[] = [
      { name: 'visual', score: 8, weight: 0.6 },
      { name: 'audio', score: 6, weight: 0.4 },
    ];
    // (8*0.6 + 6*0.4) / 1.0 = 7.2
    expect(calculateWeightedScore(dimensions)).toBeCloseTo(7.2, 1);
  });

  test('returns 0 for empty dimensions', () => {
    expect(calculateWeightedScore([])).toBe(0);
  });

  test('normalizes uneven weights', () => {
    const dimensions: QualityDimension[] = [
      { name: 'a', score: 10, weight: 1 },
      { name: 'b', score: 0, weight: 1 },
    ];
    // (10*0.5 + 0*0.5) = 5.0
    expect(calculateWeightedScore(dimensions)).toBe(5);
  });

  test('scoreQuality passes when score >= threshold', () => {
    const result = scoreQuality(
      { visual_quality: 9, audio_quality: 9, script_coherence: 9, engagement_potential: 9, brand_consistency: 9, technical_compliance: 9 },
      DEFAULT_QUALITY_WEIGHTS,
      8.0,
    );
    expect(result.passed).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(8.0);
  });

  test('scoreQuality fails when score < threshold', () => {
    const result = scoreQuality(
      { visual_quality: 5, audio_quality: 5, script_coherence: 5, engagement_potential: 5, brand_consistency: 5, technical_compliance: 5 },
      DEFAULT_QUALITY_WEIGHTS,
      8.0,
    );
    expect(result.passed).toBe(false);
    expect(result.overallScore).toBeLessThan(8.0);
  });
});
