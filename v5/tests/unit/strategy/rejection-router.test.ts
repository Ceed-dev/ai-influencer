/**
 * Tests for FEAT-STR-004: Rejection router
 */
import {
  routeRejection,
  getRejectionExplanation,
  isValidRejectionCategory,
} from '@/src/agents/strategy/rejection-router';
import type { RejectionCategory } from '@/types/database';

describe('STR-004: Rejection router', () => {
  test('routes plan_revision to plan_content', () => {
    expect(routeRejection('plan_revision')).toBe('plan_content');
  });

  test('routes data_insufficient to collect_intel', () => {
    expect(routeRejection('data_insufficient')).toBe('collect_intel');
  });

  test('routes hypothesis_weak to analyze_cycle', () => {
    expect(routeRejection('hypothesis_weak')).toBe('analyze_cycle');
  });

  test('routes null to plan_content (default)', () => {
    expect(routeRejection(null)).toBe('plan_content');
  });

  test('routes undefined to plan_content (default)', () => {
    expect(routeRejection(undefined)).toBe('plan_content');
  });

  test('provides explanation for each category', () => {
    expect(getRejectionExplanation('plan_revision')).toContain('plan_content');
    expect(getRejectionExplanation('data_insufficient')).toContain('collect_intel');
    expect(getRejectionExplanation('hypothesis_weak')).toContain('analyze_cycle');
  });

  test('validates correct categories', () => {
    expect(isValidRejectionCategory('plan_revision')).toBe(true);
    expect(isValidRejectionCategory('data_insufficient')).toBe(true);
    expect(isValidRejectionCategory('hypothesis_weak')).toBe(true);
  });

  test('rejects invalid categories', () => {
    expect(isValidRejectionCategory('invalid')).toBe(false);
    expect(isValidRejectionCategory('')).toBe(false);
  });
});
