/**
 * YouTube publishing adapter
 * Spec: 04-agent-design.md §4.7 — publish_to_youtube
 *
 * Uses YouTube Data API v3 resumable upload to upload videos.
 * OAuth credentials stored in accounts.auth_credentials:
 *   { oauth: { client_id, client_secret, refresh_token, access_token, expires_at }, channel_id }
 */
import type { Platform } from '@/types/database';
import type { PlatformAdapter, PublishTaskPayload, PublishResult } from './types.js';
import { getPool } from '../../../db/pool.js';
import { getSettingString } from '../../../lib/settings.js';
import { retryWithBackoff } from '../../../lib/retry.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface YouTubeOAuth {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  access_token: string;
  expires_at: string;
}

interface YouTubeCredentials {
  oauth: YouTubeOAuth;
  channel_id: string;
}

interface TokenRefreshResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCredentials(raw: Record<string, unknown>): YouTubeCredentials {
  const oauth = raw['oauth'] as Record<string, unknown> | undefined;
  if (!oauth) throw new Error('Missing oauth in auth_credentials');
  if (!oauth['client_id']) throw new Error('Missing oauth.client_id');
  if (!oauth['client_secret']) throw new Error('Missing oauth.client_secret');
  if (!oauth['refresh_token']) throw new Error('Missing oauth.refresh_token');

  return {
    oauth: {
      client_id: String(oauth['client_id']),
      client_secret: String(oauth['client_secret']),
      refresh_token: String(oauth['refresh_token']),
      access_token: String(oauth['access_token'] ?? ''),
      expires_at: String(oauth['expires_at'] ?? ''),
    },
    channel_id: String(raw['channel_id'] ?? ''),
  };
}

function isTokenExpired(expiresAt: string): boolean {
  if (!expiresAt) return true;
  const expiryTime = new Date(expiresAt).getTime();
  // Refresh 5 minutes before actual expiry
  return Date.now() > expiryTime - 5 * 60 * 1000;
}

/**
 * Download a file from Google Drive using service account credentials.
 * Returns the file as a Buffer.
 */
async function downloadFromDrive(driveFileId: string): Promise<Buffer> {
  const serviceAccountKeyJson = await getSettingString('CRED_GOOGLE_SERVICE_ACCOUNT_KEY');
  const serviceAccount = JSON.parse(serviceAccountKeyJson) as Record<string, unknown>;

  // Get access token for service account via JWT
  const jwt = await getServiceAccountToken(serviceAccount);

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
    { headers: { Authorization: `Bearer ${jwt}` } },
  );

  if (!response.ok) {
    throw new Error(`Drive download failed (${response.status}): ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Get an access token for a Google service account using JWT.
 */
async function getServiceAccountToken(serviceAccount: Record<string, unknown>): Promise<string> {
  const { createSign } = await import('crypto');

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: serviceAccount['client_email'],
      scope: 'https://www.googleapis.com/auth/drive.readonly',
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

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform: Platform = 'youtube';

  async publish(payload: PublishTaskPayload): Promise<PublishResult> {
    const { content_id, account_id, metadata, video_drive_id } = payload;

    if (!video_drive_id) {
      throw new Error(`No video_drive_id provided for YouTube publish (content: ${content_id})`);
    }

    // Get account credentials
    const pool = getPool();
    const accountResult = await pool.query(
      `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'youtube'`,
      [account_id],
    );

    if (accountResult.rows.length === 0) {
      throw new Error(`YouTube account not found: ${account_id}`);
    }

    const rawCreds = accountResult.rows[0]!.auth_credentials as Record<string, unknown>;
    const creds = parseCredentials(rawCreds);

    // Ensure token is fresh
    if (isTokenExpired(creds.oauth.expires_at)) {
      const refreshed = await this.refreshToken(account_id);
      if (!refreshed) {
        throw new Error(`Failed to refresh YouTube token for ${account_id}`);
      }
      // Re-read credentials after refresh
      const refreshedResult = await pool.query(
        `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'youtube'`,
        [account_id],
      );
      const refreshedCreds = refreshedResult.rows[0]!.auth_credentials as Record<string, unknown>;
      const refreshedOAuth = refreshedCreds['oauth'] as Record<string, unknown>;
      creds.oauth.access_token = String(refreshedOAuth['access_token']);
    }

    // Download video from Google Drive
    console.warn(`[youtube-adapter] Downloading video from Drive: ${video_drive_id}`);
    const videoBuffer = await retryWithBackoff(
      async () => downloadFromDrive(video_drive_id),
      {
        maxAttempts: 3,
        baseDelayMs: 2000,
        isRetryable: (err) => {
          const msg = err instanceof Error ? err.message : '';
          return msg.includes('5') || msg.includes('timeout');
        },
      },
    );

    // Step 1: Initiate resumable upload
    const title = metadata.title || `Video ${content_id}`;
    const description = metadata.description || '';
    const tags = metadata.tags || [];

    const videoMetadata = {
      snippet: {
        title,
        description,
        tags,
        categoryId: '22', // People & Blogs
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    };

    console.warn(`[youtube-adapter] Initiating resumable upload for ${content_id}`);

    const initResponse = await retryWithBackoff(
      async () => {
        const resp = await fetch(
          'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${creds.oauth.access_token}`,
              'Content-Type': 'application/json; charset=UTF-8',
              'X-Upload-Content-Length': String(videoBuffer.length),
              'X-Upload-Content-Type': 'video/mp4',
            },
            body: JSON.stringify(videoMetadata),
          },
        );

        if (resp.status === 401) {
          throw new Error('TOKEN_EXPIRED');
        }
        if (resp.status === 429) {
          throw new Error('RATE_LIMITED');
        }
        if (!resp.ok) {
          throw new Error(`YouTube initiate upload failed (${resp.status}): ${await resp.text()}`);
        }

        return resp;
      },
      {
        maxAttempts: 3,
        baseDelayMs: 2000,
        isRetryable: (err) => {
          const msg = err instanceof Error ? err.message : '';
          return msg === 'RATE_LIMITED' || msg.includes('5');
        },
      },
    );

    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('YouTube resumable upload: no Location header in initiation response');
    }

    // Step 2: Upload video data
    console.warn(`[youtube-adapter] Uploading ${videoBuffer.length} bytes to YouTube`);

    const uploadResponse = await retryWithBackoff(
      async () => {
        const resp = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(videoBuffer.length),
          },
          body: videoBuffer,
        });

        if (resp.status === 429) {
          throw new Error('RATE_LIMITED');
        }
        if (resp.status >= 500) {
          throw new Error(`YouTube upload server error (${resp.status})`);
        }
        if (!resp.ok) {
          throw new Error(`YouTube upload failed (${resp.status}): ${await resp.text()}`);
        }

        return resp;
      },
      {
        maxAttempts: 5,
        baseDelayMs: 5000,
        maxDelayMs: 60000,
        isRetryable: (err) => {
          const msg = err instanceof Error ? err.message : '';
          return msg === 'RATE_LIMITED' || msg.includes('server error');
        },
      },
    );

    const uploadResult = (await uploadResponse.json()) as Record<string, unknown>;
    const videoId = String(uploadResult['id'] ?? '');

    if (!videoId) {
      throw new Error('YouTube upload succeeded but no video ID returned');
    }

    const postedAt = new Date().toISOString();
    const postUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.warn(`[youtube-adapter] Published: ${postUrl}`);

    return {
      platform_post_id: videoId,
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

    const rawCreds = result.rows[0]!.auth_credentials as Record<string, unknown> | null;
    if (!rawCreds) return false;

    let creds: YouTubeCredentials;
    try {
      creds = parseCredentials(rawCreds);
    } catch {
      return false;
    }

    try {
      const response = await retryWithBackoff(
        async () => {
          const resp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: creds.oauth.client_id,
              client_secret: creds.oauth.client_secret,
              refresh_token: creds.oauth.refresh_token,
              grant_type: 'refresh_token',
            }),
          });

          if (!resp.ok) {
            throw new Error(`YouTube token refresh failed (${resp.status}): ${await resp.text()}`);
          }

          return (await resp.json()) as TokenRefreshResponse;
        },
        { maxAttempts: 3, baseDelayMs: 1000 },
      );

      // Calculate new expiry time
      const expiresAt = new Date(Date.now() + response.expires_in * 1000).toISOString();

      // Update credentials in DB
      await pool.query(
        `UPDATE accounts
         SET auth_credentials = jsonb_set(
           jsonb_set(auth_credentials, '{oauth,access_token}', to_jsonb($2::text)),
           '{oauth,expires_at}', to_jsonb($3::text)
         )
         WHERE account_id = $1`,
        [accountId, response.access_token, expiresAt],
      );

      console.warn(`[youtube-adapter] Token refreshed for ${accountId}, expires: ${expiresAt}`);
      return true;
    } catch (err) {
      console.error(
        `[youtube-adapter] Token refresh failed for ${accountId}:`,
        err instanceof Error ? err.message : String(err),
      );
      return false;
    }
  }
}
