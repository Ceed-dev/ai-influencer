/**
 * Tests for FEAT-INT-006: Auto-deactivate learnings
 */
import { shouldDeactivate } from '@/src/agents/intelligence/auto-deactivate';

describe('INT-006: Auto-deactivate learnings', () => {
  test('deactivates when confidence below threshold', () => {
    expect(shouldDeactivate(0.1, 0.2)).toBe(true);
  });

  test('does not deactivate when confidence above threshold', () => {
    expect(shouldDeactivate(0.5, 0.2)).toBe(false);
  });

  test('does not deactivate when confidence equals threshold', () => {
    expect(shouldDeactivate(0.2, 0.2)).toBe(false);
  });

  test('deactivates at zero confidence', () => {
    expect(shouldDeactivate(0, 0.1)).toBe(true);
  });
});
