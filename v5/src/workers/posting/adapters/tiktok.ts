/**
 * TikTok publishing adapter
 * Spec: 04-agent-design.md §4.7 — publish_to_tiktok
 *
 * Uses TikTok Content Posting API to upload videos.
 * OAuth credentials stored in accounts.auth_credentials:
 *   { oauth: { client_key, client_secret, access_token, refresh_token, expires_at }, open_id }
 */
import type { Platform } from '@/types/database';
import type { PlatformAdapter, PublishTaskPayload, PublishResult } from './types.js';
import { getPool } from '../../../db/pool.js';
import { getSettingString } from '../../../lib/settings.js';
import { retryWithBackoff } from '../../../lib/retry.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface TikTokOAuth {
  client_key: string;
  client_secret: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface TikTokCredentials {
  oauth: TikTokOAuth;
  open_id: string;
}

interface TikTokInitResponse {
  data: {
    publish_id: string;
    upload_url: string;
  };
  error: {
    code: string;
    message: string;
  };
}

interface TikTokStatusResponse {
  data: {
    status: string;
    publicaly_available_post_id?: string[];
  };
  error: {
    code: string;
    message: string;
  };
}

interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  open_id: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCredentials(raw: Record<string, unknown>): TikTokCredentials {
  const oauth = raw['oauth'] as Record<string, unknown> | undefined;
  if (!oauth) throw new Error('Missing oauth in auth_credentials');
  if (!oauth['client_key']) throw new Error('Missing oauth.client_key');
  if (!oauth['client_secret']) throw new Error('Missing oauth.client_secret');
  if (!oauth['refresh_token']) throw new Error('Missing oauth.refresh_token');

  return {
    oauth: {
      client_key: String(oauth['client_key']),
      client_secret: String(oauth['client_secret']),
      access_token: String(oauth['access_token'] ?? ''),
      refresh_token: String(oauth['refresh_token']),
      expires_at: String(oauth['expires_at'] ?? ''),
    },
    open_id: String(raw['open_id'] ?? ''),
  };
}

function isTokenExpired(expiresAt: string): boolean {
  if (!expiresAt) return true;
  const expiryTime = new Date(expiresAt).getTime();
  return Date.now() > expiryTime - 5 * 60 * 1000;
}

/**
 * Download a file from Google Drive using service account credentials.
 */
async function downloadFromDrive(driveFileId: string): Promise<Buffer> {
  const serviceAccountKeyJson = await getSettingString('CRED_GOOGLE_SERVICE_ACCOUNT_KEY');
  const serviceAccount = JSON.parse(serviceAccountKeyJson) as Record<string, unknown>;
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

export class TikTokAdapter implements PlatformAdapter {
  readonly platform: Platform = 'tiktok';

  async publish(payload: PublishTaskPayload): Promise<PublishResult> {
    const { content_id, account_id, metadata, video_drive_id } = payload;

    if (!video_drive_id) {
      throw new Error(`No video_drive_id provided for TikTok publish (content: ${content_id})`);
    }

    const pool = getPool();
    const accountResult = await pool.query(
      `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'tiktok'`,
      [account_id],
    );

    if (accountResult.rows.length === 0) {
      throw new Error(`TikTok account not found: ${account_id}`);
    }

    const rawCreds = accountResult.rows[0]!.auth_credentials as Record<string, unknown>;
    const creds = parseCredentials(rawCreds);

    // Ensure token is fresh
    if (isTokenExpired(creds.oauth.expires_at)) {
      const refreshed = await this.refreshToken(account_id);
      if (!refreshed) {
        throw new Error(`Failed to refresh TikTok token for ${account_id}`);
      }
      const refreshedResult = await pool.query(
        `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'tiktok'`,
        [account_id],
      );
      const refreshedCreds = refreshedResult.rows[0]!.auth_credentials as Record<string, unknown>;
      const refreshedOAuth = refreshedCreds['oauth'] as Record<string, unknown>;
      creds.oauth.access_token = String(refreshedOAuth['access_token']);
    }

    // Download video from Google Drive
    console.warn(`[tiktok-adapter] Downloading video from Drive: ${video_drive_id}`);
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

    // Step 1: Initialize upload
    const description = metadata.description || metadata.caption || '';
    const tags = metadata.tags || [];
    const caption = [description, ...tags.map((t) => `#${t}`)].join(' ');

    console.warn(`[tiktok-adapter] Initiating TikTok upload for ${content_id}`);

    const initResult = await retryWithBackoff(
      async () => {
        const resp = await fetch(
          'https://open.tiktokapis.com/v2/post/publish/video/init/',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${creds.oauth.access_token}`,
              'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify({
              post_info: {
                title: caption.slice(0, 150),
                privacy_level: 'SELF_ONLY', // Start private, can be changed
                disable_duet: false,
                disable_comment: false,
                disable_stitch: false,
              },
              source_info: {
                source: 'FILE_UPLOAD',
                video_size: videoBuffer.length,
                chunk_size: videoBuffer.length,
                total_chunk_count: 1,
              },
            }),
          },
        );

        if (resp.status === 401) throw new Error('TOKEN_EXPIRED');
        if (resp.status === 429) throw new Error('RATE_LIMITED');
        if (!resp.ok) {
          throw new Error(`TikTok init upload failed (${resp.status}): ${await resp.text()}`);
        }

        return (await resp.json()) as TikTokInitResponse;
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

    if (initResult.error?.code && initResult.error.code !== 'ok') {
      throw new Error(`TikTok init failed: ${initResult.error.code} - ${initResult.error.message}`);
    }

    const uploadUrl = initResult.data.upload_url;
    const publishId = initResult.data.publish_id;

    // Step 2: Upload video
    console.warn(`[tiktok-adapter] Uploading ${videoBuffer.length} bytes to TikTok`);

    await retryWithBackoff(
      async () => {
        const resp = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Range': `bytes 0-${videoBuffer.length - 1}/${videoBuffer.length}`,
          },
          body: videoBuffer,
        });

        if (resp.status >= 500) throw new Error(`TikTok upload server error (${resp.status})`);
        if (!resp.ok) {
          throw new Error(`TikTok upload failed (${resp.status}): ${await resp.text()}`);
        }
      },
      {
        maxAttempts: 5,
        baseDelayMs: 5000,
        maxDelayMs: 60000,
        isRetryable: (err) => {
          const msg = err instanceof Error ? err.message : '';
          return msg.includes('server error');
        },
      },
    );

    // Step 3: Poll for publish status
    console.warn(`[tiktok-adapter] Polling publish status for publish_id: ${publishId}`);

    let platformPostId = '';
    const maxPolls = 30;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusResp = await fetch(
        'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.oauth.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ publish_id: publishId }),
        },
      );

      if (!statusResp.ok) continue;

      const statusData = (await statusResp.json()) as TikTokStatusResponse;
      const status = statusData.data?.status;

      if (status === 'PUBLISH_COMPLETE') {
        const postIds = statusData.data?.publicaly_available_post_id;
        platformPostId = postIds?.[0] ?? publishId;
        break;
      }

      if (status === 'FAILED') {
        throw new Error(`TikTok publish failed: ${statusData.error?.message ?? 'unknown error'}`);
      }

      // PROCESSING_UPLOAD or SENDING_TO_USER_INBOX — keep polling
    }

    if (!platformPostId) {
      // Use publishId as fallback if polling timed out
      platformPostId = publishId;
      console.warn(`[tiktok-adapter] Publish status polling timed out, using publish_id: ${publishId}`);
    }

    const postedAt = new Date().toISOString();
    const postUrl = `https://www.tiktok.com/@${creds.open_id}/video/${platformPostId}`;

    console.warn(`[tiktok-adapter] Published: ${postUrl}`);

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

    const rawCreds = result.rows[0]!.auth_credentials as Record<string, unknown> | null;
    if (!rawCreds) return false;

    let creds: TikTokCredentials;
    try {
      creds = parseCredentials(rawCreds);
    } catch {
      return false;
    }

    try {
      const response = await retryWithBackoff(
        async () => {
          const resp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_key: creds.oauth.client_key,
              client_secret: creds.oauth.client_secret,
              grant_type: 'refresh_token',
              refresh_token: creds.oauth.refresh_token,
            }),
          });

          if (!resp.ok) {
            throw new Error(`TikTok token refresh failed (${resp.status}): ${await resp.text()}`);
          }

          return (await resp.json()) as TikTokTokenResponse;
        },
        { maxAttempts: 3, baseDelayMs: 1000 },
      );

      const expiresAt = new Date(Date.now() + response.expires_in * 1000).toISOString();

      // Update credentials in DB — update both access_token and refresh_token
      await pool.query(
        `UPDATE accounts
         SET auth_credentials = jsonb_set(
           jsonb_set(
             jsonb_set(auth_credentials, '{oauth,access_token}', to_jsonb($2::text)),
             '{oauth,refresh_token}', to_jsonb($3::text)
           ),
           '{oauth,expires_at}', to_jsonb($4::text)
         )
         WHERE account_id = $1`,
        [accountId, response.access_token, response.refresh_token, expiresAt],
      );

      console.warn(`[tiktok-adapter] Token refreshed for ${accountId}, expires: ${expiresAt}`);
      return true;
    } catch (err) {
      console.error(
        `[tiktok-adapter] Token refresh failed for ${accountId}:`,
        err instanceof Error ? err.message : String(err),
      );
      return false;
    }
  }
}
