/**
 * Tests: TEST-WKR-005, TEST-WKR-006, TEST-WKR-034
 */
import { retryWithBackoff, calculateDelay, withTimeout, TimeoutError, MaxRetriesExceededError } from '../../../../src/lib/retry';

describe('Retry with Exponential Backoff', () => {
  describe('TEST-WKR-005: exponential backoff', () => {
    it('retries on failure and succeeds', async () => {
      let n = 0;
      const r = await retryWithBackoff(async () => { n++; if (n < 3) throw new Error('t'); return 'ok'; }, { maxAttempts: 3, baseDelayMs: 10, timeoutMs: 5000 });
      expect(r).toBe('ok');
      expect(n).toBe(3);
    });

    it('throws MaxRetriesExceededError after max', async () => {
      await expect(retryWithBackoff(async () => { throw new Error('x'); }, { maxAttempts: 3, baseDelayMs: 10, timeoutMs: 5000 })).rejects.toThrow(MaxRetriesExceededError);
    });

    it('does not retry non-retryable errors', async () => {
      let n = 0;
      await expect(retryWithBackoff(async () => { n++; throw new Error('p'); }, { maxAttempts: 3, baseDelayMs: 10, timeoutMs: 5000, isRetryable: () => false })).rejects.toThrow('p');
      expect(n).toBe(1);
    });

    it('calls onRetry callback', async () => {
      const retries: number[] = [];
      let n = 0;
      await retryWithBackoff(async () => { n++; if (n < 3) throw new Error('t'); return 'ok'; }, { maxAttempts: 3, baseDelayMs: 10, timeoutMs: 5000, onRetry: (a) => retries.push(a) });
      expect(retries).toEqual([1, 2]);
    });
  });

  describe('TEST-WKR-006: timeout handling', () => {
    it('throws TimeoutError on timeout', async () => {
      await expect(withTimeout(async () => { await new Promise((r) => setTimeout(r, 5000)); return 'late'; }, 50)).rejects.toThrow(TimeoutError);
    });

    it('includes timeout in message', async () => {
      await expect(withTimeout(async () => { await new Promise((r) => setTimeout(r, 5000)); return ''; }, 100)).rejects.toThrow(/timeout/i);
    });

    it('succeeds before timeout', async () => {
      expect(await withTimeout(async () => 'fast', 5000)).toBe('fast');
    });
  });

  describe('TEST-WKR-034: jitter', () => {
    it('produces varied delays', () => {
      const d = Array.from({ length: 20 }, () => calculateDelay(1, 1000, 2.0, 300000, 0.2));
      expect(Math.max(...d) - Math.min(...d)).toBeGreaterThan(0);
      d.forEach((v) => { expect(v).toBeGreaterThanOrEqual(1600); expect(v).toBeLessThanOrEqual(2400); });
    });

    it('not all identical', () => {
      const d = Array.from({ length: 10 }, () => calculateDelay(0, 1000, 2.0, 300000, 0.2));
      expect(new Set(d).size).toBeGreaterThan(1);
    });

    it('caps at maxDelayMs', () => {
      const d = calculateDelay(20, 1000, 2.0, 5000, 0.2);
      expect(d).toBeLessThanOrEqual(6000);
      expect(d).toBeGreaterThanOrEqual(4000);
    });

    it('increases exponentially', () => {
      expect(calculateDelay(0, 1000, 2.0, 300000, 0)).toBe(1000);
      expect(calculateDelay(1, 1000, 2.0, 300000, 0)).toBe(2000);
      expect(calculateDelay(2, 1000, 2.0, 300000, 0)).toBe(4000);
    });
  });
});
