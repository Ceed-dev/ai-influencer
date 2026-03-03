/**
 * FEAT-MCC-026: publish_to_youtube/tiktok/instagram/x
 * Spec: 04-mcp-tools.md SS2.7 #2-#5
 * Delegates to platform-specific adapters in workers/posting/adapters/.
 * Each adapter handles OAuth token refresh, Drive download, and API upload.
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
import { McpValidationError } from '../../errors.js';
import { YouTubeAdapter } from '../../../workers/posting/adapters/youtube.js';
import { TikTokAdapter } from '../../../workers/posting/adapters/tiktok.js';
import { InstagramAdapter } from '../../../workers/posting/adapters/instagram.js';
import { XAdapter } from '../../../workers/posting/adapters/x.js';

/**
 * Publish a video to YouTube via the YouTubeAdapter.
 * Downloads video from Google Drive and uploads to YouTube Data API v3.
 */
export async function publishToYoutube(
  input: PublishToYoutubeInput,
): Promise<PublishToYoutubeOutput> {
  if (!input.content_id || input.content_id.trim() === '') {
    throw new McpValidationError('content_id is required');
  }
  if (!input.account_id || input.account_id.trim() === '') {
    throw new McpValidationError('account_id is required');
  }

  const adapter = new YouTubeAdapter();
  const result = await adapter.publish({
    task_id: 0,
    content_id: input.content_id,
    account_id: input.account_id,
    platform: 'youtube',
    video_drive_id: input.video_drive_id,
    metadata: {
      title: input.title,
      description: input.description,
      tags: input.tags,
    },
  });

  return {
    platform_post_id: result.platform_post_id,
    post_url: result.post_url,
  };
}

/**
 * Publish a video to TikTok via the TikTokAdapter.
 * Uses TikTok Content Posting API v2.
 */
export async function publishToTiktok(
  input: PublishToTiktokInput,
): Promise<PublishToTiktokOutput> {
  if (!input.content_id || input.content_id.trim() === '') {
    throw new McpValidationError('content_id is required');
  }
  if (!input.account_id || input.account_id.trim() === '') {
    throw new McpValidationError('account_id is required');
  }

  const adapter = new TikTokAdapter();
  const result = await adapter.publish({
    task_id: 0,
    content_id: input.content_id,
    account_id: input.account_id,
    platform: 'tiktok',
    video_drive_id: input.video_drive_id,
    metadata: {
      description: input.description,
      tags: input.tags,
    },
  });

  return {
    platform_post_id: result.platform_post_id,
    post_url: result.post_url,
  };
}

/**
 * Publish a video to Instagram Reels via the InstagramAdapter.
 * Uses Instagram Graph API v21.0 container → publish flow.
 */
export async function publishToInstagram(
  input: PublishToInstagramInput,
): Promise<PublishToInstagramOutput> {
  if (!input.content_id || input.content_id.trim() === '') {
    throw new McpValidationError('content_id is required');
  }
  if (!input.account_id || input.account_id.trim() === '') {
    throw new McpValidationError('account_id is required');
  }

  const adapter = new InstagramAdapter();
  const result = await adapter.publish({
    task_id: 0,
    content_id: input.content_id,
    account_id: input.account_id,
    platform: 'instagram',
    video_drive_id: input.video_drive_id,
    metadata: {
      caption: input.caption,
      tags: input.tags,
    },
  });

  return {
    platform_post_id: result.platform_post_id,
    post_url: result.post_url,
  };
}

/**
 * Publish a tweet with optional video to X via the XAdapter.
 * Uses X API v2 with OAuth 1.0a HMAC-SHA1 signing.
 */
export async function publishToX(
  input: PublishToXInput,
): Promise<PublishToXOutput> {
  if (!input.content_id || input.content_id.trim() === '') {
    throw new McpValidationError('content_id is required');
  }
  if (!input.account_id || input.account_id.trim() === '') {
    throw new McpValidationError('account_id is required');
  }

  const adapter = new XAdapter();
  const result = await adapter.publish({
    task_id: 0,
    content_id: input.content_id,
    account_id: input.account_id,
    platform: 'x',
    video_drive_id: input.video_drive_id,
    metadata: {
      text: input.text,
    },
  });

  return {
    platform_post_id: result.platform_post_id,
    post_url: result.post_url,
  };
}
