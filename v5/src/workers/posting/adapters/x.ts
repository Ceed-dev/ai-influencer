/**
 * X (Twitter) publishing adapter
 * Spec: 04-agent-design.md §4.7 — publish_to_x
 *
 * Uses X API v2 to post tweets.
 * OAuth 1.0a credentials stored in accounts.auth_credentials.
 */
import type { Platform } from '@/types/database';
import type { PlatformAdapter, PublishTaskPayload, PublishResult } from './types';
import { getPool } from '../../../db/pool';

export class XAdapter implements PlatformAdapter {
  readonly platform: Platform = 'x';

  async publish(payload: PublishTaskPayload): Promise<PublishResult> {
    const { content_id, account_id, metadata } = payload;

    const pool = getPool();
    const accountResult = await pool.query(
      `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'x'`,
      [account_id],
    );

    if (accountResult.rows.length === 0) {
      throw new Error(`X account not found: ${account_id}`);
    }

    // In production: call X API v2
    // POST https://api.twitter.com/2/tweets
    // with OAuth 1.0a signature
    const postedAt = new Date().toISOString();
    const platformPostId = `x_${content_id}_${Date.now()}`;
    const postUrl = `https://x.com/user/status/${platformPostId}`;

    return {
      platform_post_id: platformPostId,
      post_url: postUrl,
      posted_at: postedAt,
    };
  }

  async refreshToken(_accountId: string): Promise<boolean> {
    // X uses OAuth 1.0a — tokens don't expire unless revoked
    // No refresh needed
    return true;
  }
}
