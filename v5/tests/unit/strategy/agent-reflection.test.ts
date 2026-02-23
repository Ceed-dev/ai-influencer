/**
 * Tests for FEAT-STR-006: Agent self-reflection score
 */
import { validateSelfScore } from '@/src/agents/strategy/agent-reflection';

describe('STR-006: Agent self-reflection', () => {
  test('validates score 1 (minimum)', () => {
    expect(validateSelfScore(1)).toBe(true);
  });

  test('validates score 10 (maximum)', () => {
    expect(validateSelfScore(10)).toBe(true);
  });

  test('validates score 5 (mid-range)', () => {
    expect(validateSelfScore(5)).toBe(true);
  });

  test('rejects score 0', () => {
    expect(validateSelfScore(0)).toBe(false);
  });

  test('rejects score 11', () => {
    expect(validateSelfScore(11)).toBe(false);
  });

  test('rejects negative score', () => {
    expect(validateSelfScore(-1)).toBe(false);
  });

  test('rejects non-integer score', () => {
    expect(validateSelfScore(7.5)).toBe(false);
  });
});
