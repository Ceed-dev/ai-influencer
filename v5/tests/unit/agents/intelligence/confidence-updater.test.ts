/**
 * Tests for FEAT-INT-005: Confidence updater
 */
import { calculateNewConfidence } from '@/src/agents/intelligence/confidence-updater';

describe('INT-005: Confidence updater', () => {
  test('confidence increases on success', () => {
    const result = calculateNewConfidence(0.5, true, 0.1, 0.15);
    expect(result).toBeGreaterThan(0.5);
  });

  test('confidence decreases on failure', () => {
    const result = calculateNewConfidence(0.5, false, 0.1, 0.15);
    expect(result).toBeLessThan(0.5);
  });

  test('confidence is clamped to [0, 1]', () => {
    const high = calculateNewConfidence(0.99, true, 0.5, 0.15);
    expect(high).toBeLessThanOrEqual(1.0);

    const low = calculateNewConfidence(0.01, false, 0.1, 0.99);
    expect(low).toBeGreaterThanOrEqual(0.0);
  });

  test('confidence grows slower near 1.0 (diminishing returns)', () => {
    const growthAt05 = calculateNewConfidence(0.5, true, 0.1) - 0.5;
    const growthAt09 = calculateNewConfidence(0.9, true, 0.1) - 0.9;
    expect(growthAt05).toBeGreaterThan(growthAt09);
  });

  test('confidence at 0 stays 0 on failure', () => {
    const result = calculateNewConfidence(0, false, 0.1, 0.15);
    expect(result).toBe(0);
  });

  test('confidence at 1 stays 1 on success', () => {
    const result = calculateNewConfidence(1, true, 0.1, 0.15);
    expect(result).toBe(1);
  });
});
