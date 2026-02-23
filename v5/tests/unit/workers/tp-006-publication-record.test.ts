/**
 * TEST-WKR-036: 投稿ワーカー — publications レコード作成
 * TEST-WKR-037: 投稿ワーカー — measure_after 自動設定
 * FEAT-TP-006: publicationsレコード作成+measure_after自動設定
 *
 * TEST-WKR-036:
 *   Prerequisites: content に status='ready' (approved) の行あり
 *   Expected: publications に1行 INSERT。status='posted', posted_at が非NULL, platform_post_id が非NULL
 *
 * TEST-WKR-037:
 *   Prerequisites: METRICS_COLLECTION_DELAY_HOURS='48'
 *   Expected: measure_after = posted_at + INTERVAL '48 hours'
 */
import { calculateMeasureAfter, recordPublication } from '@/src/workers/posting/publish-recorder';

// Mock settings
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

describe('TEST-WKR-036: publications レコード作成', () => {
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
    };

    mockGetPool.mockReturnValue(mockPool);
    mockGetSettingNumber.mockResolvedValue(48);
  });

  it('should create publications record with status=posted', async () => {
    // Mock BEGIN
    mockClient.query.mockResolvedValueOnce(undefined);
    // Mock INSERT publications
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
    // Mock INSERT task_queue
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
    // Mock COMMIT
    mockClient.query.mockResolvedValueOnce(undefined);

    const result = await recordPublication({
      content_id: 'CNT_202603_0001',
      account_id: 'ACC_0013',
      platform: 'youtube',
      platform_post_id: 'dQw4w9WgXcQ',
      post_url: 'https://youtube.com/shorts/dQw4w9WgXcQ',
      posted_at: '2026-03-05T07:00:00Z',
    });

    expect(result.publication_id).toBe(42);

    // Verify publications INSERT was called with correct params
    const insertCall = mockClient.query.mock.calls[1]!;
    expect(insertCall[0]).toContain('INSERT INTO publications');
    expect(insertCall[1]).toContain('CNT_202603_0001');
    expect(insertCall[1]).toContain('ACC_0013');
    expect(insertCall[1]).toContain('youtube');
    expect(insertCall[1]).toContain('dQw4w9WgXcQ');
    expect(insertCall[1]).toContain('2026-03-05T07:00:00Z');
  });

  it('spec: publications INSERT with status=posted, posted_at 非NULL, platform_post_id 非NULL', async () => {
    mockClient.query.mockResolvedValueOnce(undefined);
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
    mockClient.query.mockResolvedValueOnce(undefined);

    const postedAt = '2026-03-05T07:00:00Z';
    const result = await recordPublication({
      content_id: 'CNT_202603_0001',
      account_id: 'ACC_0013',
      platform: 'youtube',
      platform_post_id: 'dQw4w9WgXcQ',
      post_url: 'https://youtube.com/shorts/dQw4w9WgXcQ',
      posted_at: postedAt,
    });

    // Pass Criteria: 3カラムが全て正しい値
    expect(result.publication_id).toBeGreaterThan(0);

    // Verify INSERT SQL contains 'posted' status
    const insertCall = mockClient.query.mock.calls[1]!;
    expect(insertCall[0]).toContain("'posted'");
    // Verify posted_at is passed (non-null)
    expect(insertCall[1]).toContain(postedAt);
    // Verify platform_post_id is passed (non-null)
    expect(insertCall[1]).toContain('dQw4w9WgXcQ');
  });

  it('should create measure task in task_queue', async () => {
    mockClient.query.mockResolvedValueOnce(undefined);
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 100 }] });
    mockClient.query.mockResolvedValueOnce(undefined);

    const result = await recordPublication({
      content_id: 'CNT_202603_0001',
      account_id: 'ACC_0013',
      platform: 'youtube',
      platform_post_id: 'dQw4w9WgXcQ',
      post_url: 'https://youtube.com/shorts/dQw4w9WgXcQ',
      posted_at: '2026-03-05T07:00:00Z',
    });

    expect(result.measure_task_id).toBe(100);

    // Verify task_queue INSERT
    const taskInsertCall = mockClient.query.mock.calls[2]!;
    expect(taskInsertCall[0]).toContain('INSERT INTO task_queue');
    expect(taskInsertCall[0]).toContain("'measure'");
  });

  it('should use transaction (BEGIN/COMMIT)', async () => {
    mockClient.query.mockResolvedValueOnce(undefined);
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });
    mockClient.query.mockResolvedValueOnce(undefined);

    await recordPublication({
      content_id: 'CNT_202603_0001',
      account_id: 'ACC_0013',
      platform: 'x',
      platform_post_id: 'tweet123',
      post_url: 'https://x.com/user/status/tweet123',
      posted_at: '2026-03-05T07:00:00Z',
    });

    expect(mockClient.query.mock.calls[0]![0]).toBe('BEGIN');
    expect(mockClient.query.mock.calls[3]![0]).toBe('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should ROLLBACK on error', async () => {
    mockClient.query.mockResolvedValueOnce(undefined); // BEGIN
    mockClient.query.mockRejectedValueOnce(new Error('DB error')); // INSERT fails

    await expect(
      recordPublication({
        content_id: 'CNT_202603_0001',
        account_id: 'ACC_0013',
        platform: 'youtube',
        platform_post_id: 'abc',
        post_url: 'https://youtube.com/abc',
        posted_at: '2026-03-05T07:00:00Z',
      }),
    ).rejects.toThrow('DB error');

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

describe('TEST-WKR-037: measure_after 自動設定', () => {
  describe('calculateMeasureAfter', () => {
    it('spec: measure_after = posted_at + 48 hours', () => {
      // Prerequisites: METRICS_COLLECTION_DELAY_HOURS='48'
      const postedAt = '2026-03-05T07:00:00.000Z';
      const measureAfter = calculateMeasureAfter(postedAt, 48);

      const expected = new Date('2026-03-07T07:00:00.000Z');
      const actual = new Date(measureAfter);

      // Pass Criteria: measure_after と posted_at の差が 48時間 (± 1分)
      const diffMs = Math.abs(actual.getTime() - expected.getTime());
      expect(diffMs).toBeLessThanOrEqual(60 * 1000); // ± 1 minute
    });

    it('should handle different delay values', () => {
      const postedAt = '2026-03-05T12:00:00.000Z';

      // 24 hours
      const measure24 = calculateMeasureAfter(postedAt, 24);
      expect(new Date(measure24).toISOString()).toBe('2026-03-06T12:00:00.000Z');

      // 72 hours
      const measure72 = calculateMeasureAfter(postedAt, 72);
      expect(new Date(measure72).toISOString()).toBe('2026-03-08T12:00:00.000Z');
    });

    it('should produce valid ISO 8601 timestamps', () => {
      const postedAt = '2026-03-05T07:00:00.000Z';
      const measureAfter = calculateMeasureAfter(postedAt, 48);

      // Should be a valid date
      const date = new Date(measureAfter);
      expect(date.getTime()).not.toBeNaN();

      // Should be an ISO string
      expect(measureAfter).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('recordPublication measure_after', () => {
    let mockClient: any;

    beforeEach(() => {
      jest.clearAllMocks();

      mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };

      const mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient),
      };

      (getPool as jest.MockedFunction<typeof getPool>).mockReturnValue(mockPool as any);
      (getSettingNumber as jest.MockedFunction<typeof getSettingNumber>).mockResolvedValue(48);
    });

    it('should set measure_after using METRICS_COLLECTION_DELAY_HOURS', async () => {
      mockClient.query.mockResolvedValueOnce(undefined);
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });
      mockClient.query.mockResolvedValueOnce(undefined);

      const result = await recordPublication({
        content_id: 'CNT_202603_0001',
        account_id: 'ACC_0013',
        platform: 'youtube',
        platform_post_id: 'abc',
        post_url: 'https://youtube.com/abc',
        posted_at: '2026-03-05T07:00:00.000Z',
      });

      // measure_after should be 48 hours after posted_at
      const expected = new Date('2026-03-07T07:00:00.000Z');
      const actual = new Date(result.measure_after);
      const diffMs = Math.abs(actual.getTime() - expected.getTime());
      expect(diffMs).toBeLessThanOrEqual(60 * 1000);

      expect(getSettingNumber).toHaveBeenCalledWith('METRICS_COLLECTION_DELAY_HOURS');
    });
  });
});
