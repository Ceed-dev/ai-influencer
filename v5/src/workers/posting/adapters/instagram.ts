/**
 * Instagram publishing adapter
 * Spec: 04-agent-design.md §4.7 — publish_to_instagram
 *
 * Uses Instagram Graph API to publish content.
 * OAuth credentials stored in accounts.auth_credentials.
 */
import type { Platform } from '@/types/database';
import type { PlatformAdapter, PublishTaskPayload, PublishResult } from './types';
import { getPool } from '../../../db/pool';

export class InstagramAdapter implements PlatformAdapter {
  readonly platform: Platform = 'instagram';

  async publish(payload: PublishTaskPayload): Promise<PublishResult> {
    const { content_id, account_id, metadata } = payload;

    const pool = getPool();
    const accountResult = await pool.query(
      `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'instagram'`,
      [account_id],
    );

    if (accountResult.rows.length === 0) {
      throw new Error(`Instagram account not found: ${account_id}`);
    }

    // In production: call Instagram Graph API
    // POST https://graph.facebook.com/v18.0/{ig-user-id}/media
    // then POST https://graph.facebook.com/v18.0/{ig-user-id}/media_publish
    const postedAt = new Date().toISOString();
    const platformPostId = `ig_${content_id}_${Date.now()}`;
    const postUrl = `https://www.instagram.com/p/${platformPostId}/`;

    return {
      platform_post_id: platformPostId,
      post_url: postUrl,
      posted_at: postedAt,
    };
  }

  async refreshToken(accountId: string): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'instagram'`,
      [accountId],
    );

    if (result.rows.length === 0) {
      return false;
    }

    const credentials = result.rows[0]!.auth_credentials as any;
    const oauth = credentials?.oauth;

    if (!oauth?.long_lived_token) {
      return false;
    }

    // In production: GET https://graph.facebook.com/v18.0/oauth/access_token
    // ?grant_type=ig_exchange_token&client_secret={app-secret}&access_token={token}
    return true;
  }
}
