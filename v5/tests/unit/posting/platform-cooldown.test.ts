/**
 * Tests for FEAT-TP-005: Platform cooldown
 */
import {
  calculateNextAvailable,
  calculateRemainingMinutes,
} from '@/src/workers/posting/platform-cooldown';

describe('TP-005: Platform cooldown', () => {
  test('calculateNextAvailable adds cooldown hours', () => {
    const posted = '2026-02-23T10:00:00.000Z';
    const next = calculateNextAvailable(posted, 4);
    expect(next).toBe('2026-02-23T14:00:00.000Z');
  });

  test('calculateNextAvailable returns null for null posted_at', () => {
    expect(calculateNextAvailable(null, 4)).toBeNull();
  });

  test('calculateRemainingMinutes returns 0 when expired', () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    expect(calculateRemainingMinutes(past)).toBe(0);
  });

  test('calculateRemainingMinutes returns positive when active', () => {
    const future = new Date(Date.now() + 3600000).toISOString(); // 1 hour ahead
    const remaining = calculateRemainingMinutes(future);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(60);
  });

  test('calculateRemainingMinutes returns 0 for null', () => {
    expect(calculateRemainingMinutes(null)).toBe(0);
  });

  test('cooldown of 0 hours means immediate posting', () => {
    const posted = '2026-02-23T10:00:00.000Z';
    const next = calculateNextAvailable(posted, 0);
    expect(next).toBe(posted);
  });

  test('cooldown handles day boundary crossing', () => {
    const posted = '2026-02-23T22:00:00.000Z';
    const next = calculateNextAvailable(posted, 4);
    // 22:00 + 4h = 02:00 next day
    expect(next).toBe('2026-02-24T02:00:00.000Z');
  });
});
