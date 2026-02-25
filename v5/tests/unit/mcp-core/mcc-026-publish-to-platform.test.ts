/**
 * TEST-MCP-050: publish_to_youtube -- normal case
 * TEST-MCP-051: publish_to_tiktok -- normal case
 * TEST-MCP-052: publish_to_instagram -- normal case
 * TEST-MCP-053: publish_to_x -- normal case
 * FEAT-MCC-026: publish_to_youtube/tiktok/instagram/x
 */
import {
  publishToYoutube,
  publishToTiktok,
  publishToInstagram,
  publishToX,
} from '@/src/mcp-server/tools/publishing/publish-to-platform';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-026: publish_to_youtube/tiktok/instagram/x', () => {
  // ---------- YouTube ----------
  describe('publish_to_youtube', () => {
    test('TEST-MCP-050: returns platform_post_id and post_url', async () => {
      const result = await publishToYoutube({
        content_id: 'CNT_202603_0001',
        title: 'Morning Skincare',
        description: 'A morning skincare routine video.',
        tags: ['skincare', 'beauty'],
        video_drive_id: '1abc',
      });

      expect(typeof result.platform_post_id).toBe('string');
      expect(result.platform_post_id).not.toBe('');
      expect(result.platform_post_id).toMatch(/^youtube_\d+$/);
      expect(typeof result.post_url).toBe('string');
      expect(result.post_url).toMatch(/^https:\/\/youtube\.com\/shorts\//);
    });

    test('TEST-MCP-050: rejects empty content_id', async () => {
      await expect(
        publishToYoutube({
          content_id: '',
          title: 'Test',
          description: 'Test',
          tags: [],
          video_drive_id: '1abc',
        }),
      ).rejects.toThrow(McpValidationError);
    });
  });

  // ---------- TikTok ----------
  describe('publish_to_tiktok', () => {
    test('TEST-MCP-051: returns platform_post_id and post_url', async () => {
      const result = await publishToTiktok({
        content_id: 'CNT_202603_0001',
        description: 'Morning skincare routine',
        tags: ['skincare'],
        video_drive_id: '1abc',
      });

      expect(typeof result.platform_post_id).toBe('string');
      expect(result.platform_post_id).not.toBe('');
      expect(result.platform_post_id).toMatch(/^tiktok_\d+$/);
      expect(typeof result.post_url).toBe('string');
      expect(result.post_url).toMatch(/^https:\/\/www\.tiktok\.com\//);
    });

    test('TEST-MCP-051: rejects empty content_id', async () => {
      await expect(
        publishToTiktok({
          content_id: '',
          description: 'Test',
          tags: [],
          video_drive_id: '1abc',
        }),
      ).rejects.toThrow(McpValidationError);
    });
  });

  // ---------- Instagram ----------
  describe('publish_to_instagram', () => {
    test('TEST-MCP-052: returns platform_post_id and post_url', async () => {
      const result = await publishToInstagram({
        content_id: 'CNT_202603_0001',
        caption: 'Morning skincare',
        tags: ['skincare'],
        video_drive_id: '1abc',
      });

      expect(typeof result.platform_post_id).toBe('string');
      expect(result.platform_post_id).not.toBe('');
      expect(result.platform_post_id).toMatch(/^instagram_\d+$/);
      expect(typeof result.post_url).toBe('string');
      expect(result.post_url).toMatch(/^https:\/\/www\.instagram\.com\/reel\//);
    });

    test('TEST-MCP-052: rejects empty content_id', async () => {
      await expect(
        publishToInstagram({
          content_id: '',
          caption: 'Test',
          tags: [],
          video_drive_id: '1abc',
        }),
      ).rejects.toThrow(McpValidationError);
    });
  });

  // ---------- X (Twitter) ----------
  describe('publish_to_x', () => {
    test('TEST-MCP-053: returns platform_post_id and post_url', async () => {
      const result = await publishToX({
        content_id: 'CNT_202603_0001',
        text: 'Check out my skincare routine!',
        video_drive_id: '1abc',
      });

      expect(typeof result.platform_post_id).toBe('string');
      expect(result.platform_post_id).not.toBe('');
      expect(result.platform_post_id).toMatch(/^x_\d+$/);
      expect(typeof result.post_url).toBe('string');
      expect(result.post_url).toMatch(/^https:\/\/x\.com\//);
    });

    test('TEST-MCP-053: rejects empty content_id', async () => {
      await expect(
        publishToX({
          content_id: '',
          text: 'Test',
          video_drive_id: '1abc',
        }),
      ).rejects.toThrow(McpValidationError);
    });
  });
});
