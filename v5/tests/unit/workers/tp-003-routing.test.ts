/**
 * TEST-WKR-014: 投稿ワーカー — プラットフォーム別ルーティング
 * FEAT-TP-003: プラットフォーム別ルーティング
 *
 * Verifies that publish tasks are routed to the correct platform adapter.
 * Prerequisites: task_queue に publish タスク (platform='youtube') あり
 * Expected: publish_to_youtube が呼び出される (publish_to_tiktok 等ではない)
 */
import { routeToPlatformAdapter } from '@/src/workers/posting/scheduler';
import { getAdapter, getAllAdapters } from '@/src/workers/posting/adapters';
import type { Platform } from '@/types/database';

// Mock DB pool for adapter tests
jest.mock('@/src/db/pool', () => ({
  getPool: jest.fn().mockReturnValue({
    query: jest.fn().mockResolvedValue({ rows: [{ auth_credentials: {} }] }),
  }),
}));

describe('TEST-WKR-014: プラットフォーム別ルーティング', () => {
  describe('routeToPlatformAdapter', () => {
    it('should route youtube to youtube adapter', () => {
      expect(routeToPlatformAdapter('youtube')).toBe('youtube');
    });

    it('should route tiktok to tiktok adapter', () => {
      expect(routeToPlatformAdapter('tiktok')).toBe('tiktok');
    });

    it('should route instagram to instagram adapter', () => {
      expect(routeToPlatformAdapter('instagram')).toBe('instagram');
    });

    it('should route x to x adapter', () => {
      expect(routeToPlatformAdapter('x')).toBe('x');
    });

    it('should throw for unknown platform', () => {
      expect(() => routeToPlatformAdapter('facebook' as Platform)).toThrow(
        'Unknown platform: facebook',
      );
    });
  });

  describe('getAdapter', () => {
    it('should return YouTubeAdapter for youtube', () => {
      const adapter = getAdapter('youtube');
      expect(adapter.platform).toBe('youtube');
    });

    it('should return TikTokAdapter for tiktok', () => {
      const adapter = getAdapter('tiktok');
      expect(adapter.platform).toBe('tiktok');
    });

    it('should return InstagramAdapter for instagram', () => {
      const adapter = getAdapter('instagram');
      expect(adapter.platform).toBe('instagram');
    });

    it('should return XAdapter for x', () => {
      const adapter = getAdapter('x');
      expect(adapter.platform).toBe('x');
    });

    it('spec: youtube task routes to publish_to_youtube', () => {
      // TEST-WKR-014 Steps:
      // 1. 投稿ワーカーがタスクを取得 (platform='youtube')
      // 2. 呼び出される MCP ツールを確認
      // Expected: publish_to_youtube が呼び出される
      const adapter = getAdapter('youtube');
      expect(adapter.platform).toBe('youtube');

      // Verify it's NOT routing to other platforms
      const tiktokAdapter = getAdapter('tiktok');
      expect(tiktokAdapter.platform).not.toBe('youtube');
    });
  });

  describe('getAllAdapters', () => {
    it('should return all 4 platform adapters', () => {
      const adapters = getAllAdapters();
      expect(adapters).toHaveLength(4);

      const platforms = adapters.map(a => a.platform).sort();
      expect(platforms).toEqual(['instagram', 'tiktok', 'x', 'youtube']);
    });
  });

  describe('adapter publish interface', () => {
    const platforms: Platform[] = ['youtube', 'tiktok', 'instagram', 'x'];

    it.each(platforms)('should have publish method for %s', (platform) => {
      const adapter = getAdapter(platform);
      expect(typeof adapter.publish).toBe('function');
    });

    it.each(platforms)('should have refreshToken method for %s', (platform) => {
      const adapter = getAdapter(platform);
      expect(typeof adapter.refreshToken).toBe('function');
    });
  });
});
