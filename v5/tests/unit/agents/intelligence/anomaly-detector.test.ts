/**
 * Tests for FEAT-INT-011: Anomaly detector
 */
import {
  calculateZScore,
  classifySeverity,
  detectAnomaliesInValues,
} from '@/src/agents/intelligence/anomaly-detector';

describe('INT-011: Anomaly detector', () => {
  describe('calculateZScore', () => {
    test('returns 0 for value equal to mean', () => {
      expect(calculateZScore(100, 100, 10)).toBe(0);
    });

    test('returns positive z-score for value above mean', () => {
      expect(calculateZScore(120, 100, 10)).toBe(2);
    });

    test('returns negative z-score for value below mean', () => {
      expect(calculateZScore(80, 100, 10)).toBe(-2);
    });

    test('returns Infinity for zero stddev with non-mean value', () => {
      expect(calculateZScore(110, 100, 0)).toBe(Infinity);
    });

    test('returns 0 for zero stddev with mean value', () => {
      expect(calculateZScore(100, 100, 0)).toBe(0);
    });
  });

  describe('classifySeverity', () => {
    test('high severity for 2x sigma', () => {
      expect(classifySeverity(4.0, 2.0)).toBe('high');
    });

    test('medium severity for 1.5x sigma', () => {
      expect(classifySeverity(3.0, 2.0)).toBe('medium');
    });

    test('low severity for just above sigma', () => {
      expect(classifySeverity(2.1, 2.0)).toBe('low');
    });

    test('handles negative deviations', () => {
      expect(classifySeverity(-4.0, 2.0)).toBe('high');
    });
  });

  describe('detectAnomaliesInValues', () => {
    test('returns empty for insufficient sample size', () => {
      const values = [{ id: 'a', value: 100 }, { id: 'b', value: 200 }];
      expect(detectAnomaliesInValues(values, 2.0)).toEqual([]);
    });

    test('detects outlier in normal distribution', () => {
      const values = [
        { id: 'a', value: 100 },
        { id: 'b', value: 102 },
        { id: 'c', value: 98 },
        { id: 'd', value: 101 },
        { id: 'outlier', value: 200 },
      ];
      const results = detectAnomaliesInValues(values, 2.0);
      const anomalies = results.filter((r) => r.isAnomaly);
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies.some((a) => a.id === 'outlier')).toBe(true);
    });

    test('no anomalies in uniform distribution', () => {
      const values = [
        { id: 'a', value: 100 },
        { id: 'b', value: 101 },
        { id: 'c', value: 99 },
        { id: 'd', value: 100 },
      ];
      const results = detectAnomaliesInValues(values, 2.0);
      const anomalies = results.filter((r) => r.isAnomaly);
      expect(anomalies.length).toBe(0);
    });
  });
});
