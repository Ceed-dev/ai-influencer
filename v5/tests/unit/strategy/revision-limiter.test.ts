/**
 * Tests for FEAT-STR-005: Revision limiter
 */
import { checkRevisionLimit } from '@/src/agents/strategy/revision-limiter';

describe('STR-005: Revision limiter', () => {
  test('allows revision when under limit', () => {
    const result = checkRevisionLimit(1, 3);
    expect(result.canRevise).toBe(true);
    expect(result.forceApprove).toBe(false);
  });

  test('blocks revision when at limit', () => {
    const result = checkRevisionLimit(3, 3);
    expect(result.canRevise).toBe(false);
    expect(result.forceApprove).toBe(true);
  });

  test('blocks revision when over limit', () => {
    const result = checkRevisionLimit(5, 3);
    expect(result.canRevise).toBe(false);
    expect(result.forceApprove).toBe(true);
  });

  test('allows first revision (count=0)', () => {
    const result = checkRevisionLimit(0, 3);
    expect(result.canRevise).toBe(true);
  });

  test('reports correct counts', () => {
    const result = checkRevisionLimit(2, 3);
    expect(result.revisionCount).toBe(2);
    expect(result.maxRevisions).toBe(3);
  });
});
