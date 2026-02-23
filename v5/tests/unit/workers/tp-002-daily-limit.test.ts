/**
 * TEST-WKR-013: 投稿ワーカー — 1日投稿数制限
 * FEAT-TP-002: 1日投稿数制限(DAILY_POST_LIMIT)
 *
 * Verifies that daily post count is enforced per account per platform.
 * Prerequisites: MAX_POSTS_PER_ACCOUNT_PER_DAY = 2 (system_settings)
 * Expected: 2件は投稿成功。3件目はスキップされ翌日にリスケジュール
 */
import { checkDailyPostLimit } from '@/src/workers/posting/scheduler';

// Mock settings module
jest.mock('@/src/lib/settings', () => ({
  getSettingNumber: jest.fn(),
}));

// Mock DB pool
jest.mock('@/src/db/pool', () => ({
  getPool: jest.fn(),
}));

import { getSettingNumber } from '@/src/lib/settings';
import { getPool } from '@/src/db/pool';

const mockGetSettingNumber = getSettingNumber as jest.MockedFunction<typeof getSettingNumber>;
const mockGetPool = getPool as jest.MockedFunction<typeof getPool>;

describe('TEST-WKR-013: 1日投稿数制限', () => {
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = jest.fn();
    mockGetPool.mockReturnValue({ query: mockQuery } as any);
  });

  it('should return limitReached=false when under daily limit', async () => {
    mockGetSettingNumber.mockResolvedValue(2);
    mockQuery.mockResolvedValue({ rows: [{ cnt: 1 }] });

    const result = await checkDailyPostLimit('ACC_0001', 'youtube');

    expect(result.limitReached).toBe(false);
    expect(result.currentCount).toBe(1);
    expect(result.maxPosts).toBe(2);
  });

  it('should return limitReached=true when at daily limit', async () => {
    mockGetSettingNumber.mockResolvedValue(2);
    mockQuery.mockResolvedValue({ rows: [{ cnt: 2 }] });

    const result = await checkDailyPostLimit('ACC_0001', 'youtube');

    expect(result.limitReached).toBe(true);
    expect(result.currentCount).toBe(2);
    expect(result.maxPosts).toBe(2);
  });

  it('should return limitReached=true when over daily limit', async () => {
    mockGetSettingNumber.mockResolvedValue(2);
    mockQuery.mockResolvedValue({ rows: [{ cnt: 3 }] });

    const result = await checkDailyPostLimit('ACC_0001', 'youtube');

    expect(result.limitReached).toBe(true);
    expect(result.currentCount).toBe(3);
    expect(result.maxPosts).toBe(2);
  });

  it('spec: 3件投稿タスクで2件成功、3件目スキップ', async () => {
    // TEST-WKR-013 Steps:
    // 1. 同一アカウントで3件の投稿タスクを投入
    // 2. ワーカーの処理を確認
    // Expected: 2件は投稿成功。3件目はスキップされ翌日にリスケジュール
    mockGetSettingNumber.mockResolvedValue(2);

    // Simulate 3 sequential post attempts
    // Attempt 1: 0 posts today → OK
    mockQuery.mockResolvedValueOnce({ rows: [{ cnt: 0 }] });
    const result1 = await checkDailyPostLimit('ACC_0001', 'youtube');
    expect(result1.limitReached).toBe(false);

    // Attempt 2: 1 post today → OK
    mockQuery.mockResolvedValueOnce({ rows: [{ cnt: 1 }] });
    const result2 = await checkDailyPostLimit('ACC_0001', 'youtube');
    expect(result2.limitReached).toBe(false);

    // Attempt 3: 2 posts today → BLOCKED (limit reached)
    mockQuery.mockResolvedValueOnce({ rows: [{ cnt: 2 }] });
    const result3 = await checkDailyPostLimit('ACC_0001', 'youtube');
    expect(result3.limitReached).toBe(true);
    expect(result3.currentCount).toBe(2);
  });

  it('should query only current day publications', async () => {
    mockGetSettingNumber.mockResolvedValue(2);
    mockQuery.mockResolvedValue({ rows: [{ cnt: 0 }] });

    await checkDailyPostLimit('ACC_0013', 'x');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('CURRENT_DATE'),
      ['ACC_0013', 'x'],
    );
  });

  it('should use MAX_POSTS_PER_ACCOUNT_PER_DAY from system_settings', async () => {
    mockGetSettingNumber.mockResolvedValue(5);
    mockQuery.mockResolvedValue({ rows: [{ cnt: 4 }] });

    const result = await checkDailyPostLimit('ACC_0001', 'youtube');

    expect(mockGetSettingNumber).toHaveBeenCalledWith('MAX_POSTS_PER_ACCOUNT_PER_DAY');
    expect(result.limitReached).toBe(false);
    expect(result.maxPosts).toBe(5);
  });

  it('should handle zero posts gracefully', async () => {
    mockGetSettingNumber.mockResolvedValue(2);
    mockQuery.mockResolvedValue({ rows: [{ cnt: 0 }] });

    const result = await checkDailyPostLimit('ACC_0001', 'tiktok');

    expect(result.limitReached).toBe(false);
    expect(result.currentCount).toBe(0);
  });
});
