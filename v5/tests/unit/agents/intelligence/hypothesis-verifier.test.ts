/**
 * Tests for FEAT-INT-009: Hypothesis verifier
 */
import { calculateDeviation, determineVerdict } from '@/src/agents/intelligence/hypothesis-verifier';

describe('INT-009: Hypothesis verifier', () => {
  describe('calculateDeviation', () => {
    test('zero deviation when predicted equals actual', () => {
      const predicted = { views: 1000, engagement_rate: 0.05 };
      const actual = { views: 1000, engagement_rate: 0.05 };
      expect(calculateDeviation(predicted, actual)).toBeCloseTo(0);
    });

    test('calculates MAPE correctly', () => {
      const predicted = { views: 1200 };
      const actual = { views: 1000 };
      // |1200 - 1000| / 1000 = 0.2
      expect(calculateDeviation(predicted, actual)).toBeCloseTo(0.2);
    });

    test('averages across multiple KPIs', () => {
      const predicted = { views: 1200, engagement_rate: 0.06 };
      const actual = { views: 1000, engagement_rate: 0.05 };
      // views: 0.2, engagement: 0.2 => avg 0.2
      expect(calculateDeviation(predicted, actual)).toBeCloseTo(0.2);
    });

    test('returns 1.0 when no comparable keys', () => {
      const predicted = { views: 1000 };
      const actual = { likes: 100 };
      expect(calculateDeviation(predicted, actual)).toBe(1.0);
    });

    test('skips keys with zero actual values', () => {
      const predicted = { views: 1000, likes: 50 };
      const actual = { views: 0, likes: 50 };
      // Only likes: |50-50|/50 = 0
      expect(calculateDeviation(predicted, actual)).toBeCloseTo(0);
    });
  });

  describe('determineVerdict', () => {
    test('confirmed when deviation <= confirmThreshold', () => {
      expect(determineVerdict(0.15, 0.2, 0.5)).toBe('confirmed');
    });

    test('rejected when deviation >= rejectThreshold', () => {
      expect(determineVerdict(0.6, 0.2, 0.5)).toBe('rejected');
    });

    test('inconclusive when between thresholds', () => {
      expect(determineVerdict(0.35, 0.2, 0.5)).toBe('inconclusive');
    });

    test('confirmed at exact confirmThreshold', () => {
      expect(determineVerdict(0.2, 0.2, 0.5)).toBe('confirmed');
    });

    test('rejected at exact rejectThreshold', () => {
      expect(determineVerdict(0.5, 0.2, 0.5)).toBe('rejected');
    });
  });
});
