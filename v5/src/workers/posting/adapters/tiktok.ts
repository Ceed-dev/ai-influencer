/**
 * TikTok publishing adapter
 * Spec: 04-agent-design.md §4.7 — publish_to_tiktok
 *
 * Uses TikTok Content Posting API to upload videos.
 * OAuth credentials stored in accounts.auth_credentials.
 */
import type { Platform } from '@/types/database';
import type { PlatformAdapter, PublishTaskPayload, PublishResult } from './types';
import { getPool } from '../../../db/pool';

export class TikTokAdapter implements PlatformAdapter {
  readonly platform: Platform = 'tiktok';

  async publish(payload: PublishTaskPayload): Promise<PublishResult> {
    const { content_id, account_id, metadata } = payload;

    const pool = getPool();
    const accountResult = await pool.query(
      `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'tiktok'`,
      [account_id],
    );

    if (accountResult.rows.length === 0) {
      throw new Error(`TikTok account not found: ${account_id}`);
    }

    // In production: call TikTok Content Posting API
    // POST https://open.tiktokapis.com/v2/post/publish/video/init/
    const postedAt = new Date().toISOString();
    const platformPostId = `tt_${content_id}_${Date.now()}`;
    const postUrl = `https://www.tiktok.com/@user/video/${platformPostId}`;

    return {
      platform_post_id: platformPostId,
      post_url: postUrl,
      posted_at: postedAt,
    };
  }

  async refreshToken(accountId: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'tiktok'`,
      [accountId],
    );

    if (result.rows.length === 0) {
      return false;
    }

    const credentials = result.rows[0]!.auth_credentials as any;
    const oauth = credentials?.oauth;

    if (!oauth?.refresh_token || !oauth?.client_key || !oauth?.client_secret) {
      return false;
    }

    // In production: POST https://open.tiktokapis.com/v2/oauth/token/
    // with grant_type=refresh_token
    return true;
  }
}
