/**
 * Instagram publishing adapter
 * Spec: 04-agent-design.md §4.7 — publish_to_instagram
 *
 * Uses Instagram Graph API to publish Reels.
 * OAuth credentials stored in accounts.auth_credentials:
 *   { oauth: { app_id, app_secret, long_lived_token, expires_at }, ig_user_id, page_id }
 *
 * Flow: create container → poll status → publish container
 */
import type { Platform } from '@/types/database';
import type { PlatformAdapter, PublishTaskPayload, PublishResult } from './types.js';
import { getPool } from '../../../db/pool.js';
import { getSettingString } from '../../../lib/settings.js';
import { retryWithBackoff } from '../../../lib/retry.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface InstagramOAuth {
  app_id: string;
  app_secret: string;
  long_lived_token: string;
  expires_at: string;
}

interface InstagramCredentials {
  oauth: InstagramOAuth;
  ig_user_id: string;
  page_id: string;
}

interface ContainerResponse {
  id: string;
  error?: { message: string; code: number };
}

interface ContainerStatusResponse {
  status_code: string;
  id: string;
}

interface PublishResponse {
  id: string;
  error?: { message: string; code: number };
}

interface TokenRefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCredentials(raw: Record<string, unknown>): InstagramCredentials {
  const oauth = raw['oauth'] as Record<string, unknown> | undefined;
  if (!oauth) throw new Error('Missing oauth in auth_credentials');
  if (!oauth['long_lived_token']) throw new Error('Missing oauth.long_lived_token');

  return {
    oauth: {
      app_id: String(oauth['app_id'] ?? ''),
      app_secret: String(oauth['app_secret'] ?? ''),
      long_lived_token: String(oauth['long_lived_token']),
      expires_at: String(oauth['expires_at'] ?? ''),
    },
    ig_user_id: String(raw['ig_user_id'] ?? ''),
    page_id: String(raw['page_id'] ?? ''),
  };
}

function isTokenExpired(expiresAt: string): boolean {
  if (!expiresAt) return true;
  const expiryTime = new Date(expiresAt).getTime();
  // Refresh 24 hours before actual expiry (IG tokens last 60 days)
  return Date.now() > expiryTime - 24 * 60 * 60 * 1000;
}

/**
 * Get a publicly accessible Google Drive download URL for the video.
 * Uses service account to generate an authorized URL.
 */
async function getDriveVideoUrl(driveFileId: string): Promise<string> {
  const serviceAccountKeyJson = await getSettingString('CRED_GOOGLE_SERVICE_ACCOUNT_KEY');
  const serviceAccount = JSON.parse(serviceAccountKeyJson) as Record<string, unknown>;
  const jwt = await getServiceAccountToken(serviceAccount);

  // First, make the file publicly accessible (temporarily)
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    },
  );

  // Use the webContentLink format for direct download
  return `https://drive.google.com/uc?export=download&id=${driveFileId}`;
}

async function getServiceAccountToken(serviceAccount: Record<string, unknown>): Promise<string> {
  const { createSign } = await import('crypto');

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: serviceAccount['client_email'],
      scope: 'https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url');

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(String(serviceAccount['private_key']), 'base64url');

  const jwtToken = `${header}.${payload}.${signature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwtToken,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Service account token request failed (${tokenResponse.status})`);
  }

  const tokenData = (await tokenResponse.json()) as Record<string, unknown>;
  return String(tokenData['access_token']);
}

// ── Adapter ──────────────────────────────────────────────────────────────────

const IG_API_VERSION = 'v21.0';

export class InstagramAdapter implements PlatformAdapter {
  readonly platform: Platform = 'instagram';

  async publish(payload: PublishTaskPayload): Promise<PublishResult> {
    const { content_id, account_id, metadata, video_drive_id } = payload;

    if (!video_drive_id) {
      throw new Error(`No video_drive_id provided for Instagram publish (content: ${content_id})`);
    }

    const pool = getPool();
    const accountResult = await pool.query(
      `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'instagram'`,
      [account_id],
    );

    if (accountResult.rows.length === 0) {
      throw new Error(`Instagram account not found: ${account_id}`);
    }

    const rawCreds = accountResult.rows[0]!.auth_credentials as Record<string, unknown>;
    const creds = parseCredentials(rawCreds);

    // Refresh token if needed
    if (isTokenExpired(creds.oauth.expires_at)) {
      const refreshed = await this.refreshToken(account_id);
      if (!refreshed) {
        throw new Error(`Failed to refresh Instagram token for ${account_id}`);
      }
      const refreshedResult = await pool.query(
        `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'instagram'`,
        [account_id],
      );
      const refreshedCreds = refreshedResult.rows[0]!.auth_credentials as Record<string, unknown>;
      const refreshedOAuth = refreshedCreds['oauth'] as Record<string, unknown>;
      creds.oauth.long_lived_token = String(refreshedOAuth['long_lived_token']);
    }

    // Get publicly accessible URL for the video
    console.warn(`[instagram-adapter] Getting public URL for Drive file: ${video_drive_id}`);
    const videoUrl = await getDriveVideoUrl(video_drive_id);

    // Build caption
    const caption = metadata.caption || metadata.description || '';
    const tags = metadata.tags || [];
    const fullCaption = [caption, ...tags.map((t) => `#${t}`)].join(' ');

    // Step 1: Create media container
    console.warn(`[instagram-adapter] Creating Reels container for ${content_id}`);

    const containerResult = await retryWithBackoff(
      async () => {
        const params = new URLSearchParams({
          media_type: 'REELS',
          video_url: videoUrl,
          caption: fullCaption.slice(0, 2200),
          access_token: creds.oauth.long_lived_token,
        });

        const resp = await fetch(
          `https://graph.instagram.com/${IG_API_VERSION}/${creds.ig_user_id}/media`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
          },
        );

        if (resp.status === 429) throw new Error('RATE_LIMITED');
        if (!resp.ok) {
          throw new Error(`IG container create failed (${resp.status}): ${await resp.text()}`);
        }

        return (await resp.json()) as ContainerResponse;
      },
      {
        maxAttempts: 3,
        baseDelayMs: 5000,
        isRetryable: (err) => {
          const msg = err instanceof Error ? err.message : '';
          return msg === 'RATE_LIMITED' || msg.includes('5');
        },
      },
    );

    if (containerResult.error) {
      throw new Error(`IG container error: ${containerResult.error.message}`);
    }

    const containerId = containerResult.id;

    // Step 2: Poll container status until FINISHED
    console.warn(`[instagram-adapter] Polling container status: ${containerId}`);

    const maxPolls = 60; // Up to 5 minutes (60 * 5s)
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusResp = await fetch(
        `https://graph.instagram.com/${IG_API_VERSION}/${containerId}?fields=status_code&access_token=${creds.oauth.long_lived_token}`,
      );

      if (!statusResp.ok) continue;

      const statusData = (await statusResp.json()) as ContainerStatusResponse;

      if (statusData.status_code === 'FINISHED') {
        break;
      }

      if (statusData.status_code === 'ERROR') {
        throw new Error(`Instagram container processing failed for ${containerId}`);
      }

      // IN_PROGRESS — keep polling
    }

    // Step 3: Publish the container
    console.warn(`[instagram-adapter] Publishing container: ${containerId}`);

    const publishResult = await retryWithBackoff(
      async () => {
        const params = new URLSearchParams({
          creation_id: containerId,
          access_token: creds.oauth.long_lived_token,
        });

        const resp = await fetch(
          `https://graph.instagram.com/${IG_API_VERSION}/${creds.ig_user_id}/media_publish`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
          },
        );

        if (resp.status === 429) throw new Error('RATE_LIMITED');
        if (!resp.ok) {
          throw new Error(`IG publish failed (${resp.status}): ${await resp.text()}`);
        }

        return (await resp.json()) as PublishResponse;
      },
      {
        maxAttempts: 3,
        baseDelayMs: 5000,
        isRetryable: (err) => {
          const msg = err instanceof Error ? err.message : '';
          return msg === 'RATE_LIMITED';
        },
      },
    );

    if (publishResult.error) {
      throw new Error(`IG publish error: ${publishResult.error.message}`);
    }

    const mediaId = publishResult.id;
    const postedAt = new Date().toISOString();
    const postUrl = `https://www.instagram.com/reel/${mediaId}/`;

    console.warn(`[instagram-adapter] Published: ${postUrl}`);

    return {
      platform_post_id: mediaId,
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

    const rawCreds = result.rows[0]!.auth_credentials as Record<string, unknown> | null;
    if (!rawCreds) return false;

    let creds: InstagramCredentials;
    try {
      creds = parseCredentials(rawCreds);
    } catch {
      return false;
    }

    try {
      const response = await retryWithBackoff(
        async () => {
          const params = new URLSearchParams({
            grant_type: 'ig_refresh_token',
            access_token: creds.oauth.long_lived_token,
          });

          const resp = await fetch(
            `https://graph.instagram.com/refresh_access_token?${params.toString()}`,
          );

          if (!resp.ok) {
            throw new Error(`IG token refresh failed (${resp.status}): ${await resp.text()}`);
          }

          return (await resp.json()) as TokenRefreshResponse;
        },
        { maxAttempts: 3, baseDelayMs: 1000 },
      );

      const expiresAt = new Date(Date.now() + response.expires_in * 1000).toISOString();

      // Update credentials in DB
      await pool.query(
        `UPDATE accounts
         SET auth_credentials = jsonb_set(
           jsonb_set(auth_credentials, '{oauth,long_lived_token}', to_jsonb($2::text)),
           '{oauth,expires_at}', to_jsonb($3::text)
         )
         WHERE account_id = $1`,
        [accountId, response.access_token, expiresAt],
      );

      console.warn(`[instagram-adapter] Token refreshed for ${accountId}, expires: ${expiresAt}`);
      return true;
    } catch (err) {
      console.error(
        `[instagram-adapter] Token refresh failed for ${accountId}:`,
        err instanceof Error ? err.message : String(err),
      );
      return false;
    }
  }
}
