/**
 * TEST-WKR-012: 投稿ワーカー — 投稿時刻ジッター
 * FEAT-TP-001: 投稿時刻ジッター(±15分ランダム)
 *
 * Verifies that posting times are randomly jittered within ±POSTING_TIME_JITTER_MIN
 */
import { calculateJitter, applyPostingJitter } from '@/src/workers/posting/scheduler';

// Mock settings module
jest.mock('@/src/lib/settings', () => ({
  getSettingNumber: jest.fn(),
}));

import { getSettingNumber } from '@/src/lib/settings';

const mockGetSettingNumber = getSettingNumber as jest.MockedFunction<typeof getSettingNumber>;

describe('TEST-WKR-012: 投稿時刻ジッター', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateJitter', () => {
    it('should return jitter within ±jitterMinutes range', () => {
      const scheduledTime = new Date('2026-03-01T10:00:00Z');
      const jitterMinutes = 5;
      const maxJitterMs = jitterMinutes * 60 * 1000; // 300,000 ms

      // Run 100 times to verify distribution
      const jitters: number[] = [];
      for (let i = 0; i < 100; i++) {
        const result = calculateJitter(scheduledTime, jitterMinutes);
        jitters.push(result.jitterMs);

        // Each jitter must be within ±5 minutes
        expect(Math.abs(result.jitterMs)).toBeLessThanOrEqual(maxJitterMs);

        // Scheduled time with jitter should be within range
        const diff = result.scheduledWithJitter.getTime() - scheduledTime.getTime();
        expect(Math.abs(diff)).toBeLessThanOrEqual(maxJitterMs);
      }

      // Verify not all jitters are the same (randomness check)
      const uniqueJitters = new Set(jitters);
      expect(uniqueJitters.size).toBeGreaterThan(1);
    });

    it('should return zero jitter when jitterMinutes is 0', () => {
      const scheduledTime = new Date('2026-03-01T10:00:00Z');
      const result = calculateJitter(scheduledTime, 0);
      expect(result.jitterMs).toBe(0);
      expect(result.scheduledWithJitter.getTime()).toBe(scheduledTime.getTime());
    });

    it('should produce both positive and negative jitters over many runs', () => {
      const scheduledTime = new Date('2026-03-01T10:00:00Z');
      const jitterMinutes = 5;

      let hasPositive = false;
      let hasNegative = false;

      for (let i = 0; i < 100; i++) {
        const result = calculateJitter(scheduledTime, jitterMinutes);
        if (result.jitterMs > 0) hasPositive = true;
        if (result.jitterMs < 0) hasNegative = true;
        if (hasPositive && hasNegative) break;
      }

      expect(hasPositive).toBe(true);
      expect(hasNegative).toBe(true);
    });

    it('spec: 10回投稿で全て ±5分以内', () => {
      // TEST-WKR-012 Steps: 同一アカウントで10回投稿を実行 (テスト環境)
      // Expected: 投稿時刻がスケジュール時刻 ± 5分の範囲でランダムにずれる
      const scheduledTime = new Date('2026-03-01T10:00:00Z');
      const jitterMinutes = 5;
      const maxJitterMs = jitterMinutes * 60 * 1000;

      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = calculateJitter(scheduledTime, jitterMinutes);
        results.push(result);

        // Pass Criteria: 全投稿の |実際 - スケジュール| <= 5分
        expect(Math.abs(result.jitterMs)).toBeLessThanOrEqual(maxJitterMs);
      }

      // Fail Indicator: 全投稿が同一時刻 (ジッターなし) should not happen
      const uniqueOffsets = new Set(results.map(r => r.jitterMs));
      expect(uniqueOffsets.size).toBeGreaterThan(1);
    });
  });

  describe('applyPostingJitter', () => {
    it('should use POSTING_TIME_JITTER_MIN from system_settings', async () => {
      mockGetSettingNumber.mockResolvedValue(5);
      const scheduledTime = new Date('2026-03-01T10:00:00Z');

      const result = await applyPostingJitter(scheduledTime);

      expect(mockGetSettingNumber).toHaveBeenCalledWith('POSTING_TIME_JITTER_MIN');
      expect(Math.abs(result.jitterMs)).toBeLessThanOrEqual(5 * 60 * 1000);
    });

    it('should respect custom jitter values from settings', async () => {
      mockGetSettingNumber.mockResolvedValue(15);
      const scheduledTime = new Date('2026-03-01T10:00:00Z');

      const result = await applyPostingJitter(scheduledTime);

      expect(Math.abs(result.jitterMs)).toBeLessThanOrEqual(15 * 60 * 1000);
    });
  });
});
