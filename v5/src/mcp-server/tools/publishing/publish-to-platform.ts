/**
 * FEAT-MCC-026: publish_to_youtube/tiktok/instagram/x
 * Spec: 04-mcp-tools.md SS2.7 #2-#5
 * Placeholder implementations for 4 platform publish tools.
 * Actual platform API integration lives in workers/posting/adapters/.
 */
import type {
  PublishToYoutubeInput,
  PublishToYoutubeOutput,
  PublishToTiktokInput,
  PublishToTiktokOutput,
  PublishToInstagramInput,
  PublishToInstagramOutput,
  PublishToXInput,
  PublishToXOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors';

/**
 * Publish a video to YouTube.
 * Placeholder: generates a synthetic post ID and URL.
 */
export async function publishToYoutube(
  input: PublishToYoutubeInput,
): Promise<PublishToYoutubeOutput> {
  if (!input.content_id || input.content_id.trim() === '') {
    throw new McpValidationError('content_id is required');
  }

  const platformPostId = `youtube_${Date.now()}`;
  const postUrl = `https://youtube.com/shorts/${platformPostId}`;

  return {
    platform_post_id: platformPostId,
    post_url: postUrl,
  };
}

/**
 * Publish a video to TikTok.
 * Placeholder: generates a synthetic post ID and URL.
 */
export async function publishToTiktok(
  input: PublishToTiktokInput,
): Promise<PublishToTiktokOutput> {
  if (!input.content_id || input.content_id.trim() === '') {
    throw new McpValidationError('content_id is required');
  }

  const platformPostId = `tiktok_${Date.now()}`;
  const postUrl = `https://www.tiktok.com/@user/video/${platformPostId}`;

  return {
    platform_post_id: platformPostId,
    post_url: postUrl,
  };
}

/**
 * Publish a video to Instagram.
 * Placeholder: generates a synthetic post ID and URL.
 */
export async function publishToInstagram(
  input: PublishToInstagramInput,
): Promise<PublishToInstagramOutput> {
  if (!input.content_id || input.content_id.trim() === '') {
    throw new McpValidationError('content_id is required');
  }

  const platformPostId = `instagram_${Date.now()}`;
  const postUrl = `https://www.instagram.com/reel/${platformPostId}`;

  return {
    platform_post_id: platformPostId,
    post_url: postUrl,
  };
}

/**
 * Publish a video to X (Twitter).
 * Placeholder: generates a synthetic post ID and URL.
 */
export async function publishToX(
  input: PublishToXInput,
): Promise<PublishToXOutput> {
  if (!input.content_id || input.content_id.trim() === '') {
    throw new McpValidationError('content_id is required');
  }

  const platformPostId = `x_${Date.now()}`;
  const postUrl = `https://x.com/user/status/${platformPostId}`;

  return {
    platform_post_id: platformPostId,
    post_url: postUrl,
  };
}
