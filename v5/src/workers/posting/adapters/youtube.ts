/**
 * YouTube publishing adapter
 * Spec: 04-agent-design.md §4.7 — publish_to_youtube
 *
 * Uses YouTube Data API v3 to upload videos and create posts.
 * OAuth credentials stored in accounts.auth_credentials.
 */
import type { Platform } from '@/types/database';
import type { PlatformAdapter, PublishTaskPayload, PublishResult } from './types';
import { getPool } from '../../../db/pool';

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform: Platform = 'youtube';

  async publish(payload: PublishTaskPayload): Promise<PublishResult> {
    const { content_id, account_id, metadata, video_drive_id } = payload;

    // Get account credentials
    const pool = getPool();
    const accountResult = await pool.query(
      `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'youtube'`,
      [account_id],
    );

    if (accountResult.rows.length === 0) {
      throw new Error(`YouTube account not found: ${account_id}`);
    }

    const credentials = accountResult.rows[0]!.auth_credentials;

    // In production: call YouTube Data API v3 to upload video
    // POST https://www.googleapis.com/upload/youtube/v3/videos
    // For now, this is the adapter structure — actual API call will be
    // implemented when platform API access is available
    const postedAt = new Date().toISOString();

    // Placeholder for actual YouTube API response
    const platformPostId = `yt_${content_id}_${Date.now()}`;
    const postUrl = `https://youtube.com/shorts/${platformPostId}`;

    return {
      platform_post_id: platformPostId,
      post_url: postUrl,
      posted_at: postedAt,
    };
  }

  async refreshToken(accountId: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'youtube'`,
      [accountId],
    );

    if (result.rows.length === 0) {
      return false;
    }

    const credentials = result.rows[0]!.auth_credentials as any;
    const oauth = credentials?.oauth;

    if (!oauth?.refresh_token || !oauth?.client_id || !oauth?.client_secret) {
      return false;
    }

    // In production: POST https://oauth2.googleapis.com/token
    // with grant_type=refresh_token
    // For now, return true as placeholder
    return true;
  }
}
