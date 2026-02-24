/**
 * X (Twitter) publishing adapter
 * Spec: 04-agent-design.md §4.7 — publish_to_x
 *
 * Uses X API v2 to post tweets with media.
 * X uses OAuth 1.0a — tokens don't expire unless revoked.
 * Implements HMAC-SHA1 signature using Node.js crypto.
 *
 * OAuth 1.0a credentials stored in accounts.auth_credentials:
 *   { oauth_1a: { api_key, api_secret, access_token, access_token_secret }, user_id }
 *
 * Video upload flow: INIT → APPEND (chunks) → FINALIZE → poll STATUS → tweet
 */
import type { Platform } from '@/types/database';
import type { PlatformAdapter, PublishTaskPayload, PublishResult } from './types.js';
import { getPool } from '../../../db/pool.js';
import { getSettingString } from '../../../lib/settings.js';
import { retryWithBackoff } from '../../../lib/retry.js';
import { createHmac, randomBytes } from 'crypto';

// ── Types ────────────────────────────────────────────────────────────────────

interface XOAuth1a {
  api_key: string;
  api_secret: string;
  access_token: string;
  access_token_secret: string;
}

interface XCredentials {
  oauth_1a: XOAuth1a;
  user_id: string;
}

interface MediaInitResponse {
  media_id_string: string;
  expires_after_secs: number;
}

interface MediaFinalizeResponse {
  media_id_string: string;
  processing_info?: {
    state: string;
    check_after_secs: number;
    progress_percent?: number;
    error?: { message: string };
  };
}

interface MediaStatusResponse {
  processing_info: {
    state: string;
    check_after_secs?: number;
    progress_percent?: number;
    error?: { message: string };
  };
}

interface TweetResponse {
  data: {
    id: string;
    text: string;
  };
}

// ── OAuth 1.0a Signature ─────────────────────────────────────────────────────

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function generateOAuthParams(oauth: XOAuth1a): Record<string, string> {
  return {
    oauth_consumer_key: oauth.api_key,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: oauth.access_token,
    oauth_version: '1.0',
  };
}

function createSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  oauth: XOAuth1a,
): string {
  // Sort parameters alphabetically
  const sortedParams = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join('&');

  // Create signature base string
  const signatureBase = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join('&');

  // Create signing key
  const signingKey = `${percentEncode(oauth.api_secret)}&${percentEncode(oauth.access_token_secret)}`;

  // HMAC-SHA1
  return createHmac('sha1', signingKey).update(signatureBase).digest('base64');
}

function buildAuthorizationHeader(
  method: string,
  url: string,
  oauth: XOAuth1a,
  extraParams?: Record<string, string>,
): string {
  const oauthParams = generateOAuthParams(oauth);
  const allParams = { ...oauthParams, ...(extraParams ?? {}) };

  const signature = createSignature(method, url, allParams, oauth);
  oauthParams['oauth_signature'] = signature;

  const headerParts = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCredentials(raw: Record<string, unknown>): XCredentials {
  const oauth1a = raw['oauth_1a'] as Record<string, unknown> | undefined;
  if (!oauth1a) throw new Error('Missing oauth_1a in auth_credentials');
  if (!oauth1a['api_key']) throw new Error('Missing oauth_1a.api_key');
  if (!oauth1a['api_secret']) throw new Error('Missing oauth_1a.api_secret');
  if (!oauth1a['access_token']) throw new Error('Missing oauth_1a.access_token');
  if (!oauth1a['access_token_secret']) throw new Error('Missing oauth_1a.access_token_secret');

  return {
    oauth_1a: {
      api_key: String(oauth1a['api_key']),
      api_secret: String(oauth1a['api_secret']),
      access_token: String(oauth1a['access_token']),
      access_token_secret: String(oauth1a['access_token_secret']),
    },
    user_id: String(raw['user_id'] ?? ''),
  };
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

const MEDIA_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const TWEET_URL = 'https://api.twitter.com/2/tweets';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export class XAdapter implements PlatformAdapter {
  readonly platform: Platform = 'x';

  async publish(payload: PublishTaskPayload): Promise<PublishResult> {
    const { content_id, account_id, metadata, video_drive_id } = payload;

    const pool = getPool();
    const accountResult = await pool.query(
      `SELECT auth_credentials FROM accounts WHERE account_id = $1 AND platform = 'x'`,
      [account_id],
    );

    if (accountResult.rows.length === 0) {
      throw new Error(`X account not found: ${account_id}`);
    }

    const rawCreds = accountResult.rows[0]!.auth_credentials as Record<string, unknown>;
    const creds = parseCredentials(rawCreds);

    // Build tweet text
    const text = metadata.text || metadata.caption || metadata.description || '';
    const tags = metadata.tags || [];
    const tweetText = [text, ...tags.map((t) => `#${t}`)].join(' ').slice(0, 280);

    let mediaId: string | undefined;

    // Upload video if available
    if (video_drive_id) {
      console.warn(`[x-adapter] Downloading video from Drive: ${video_drive_id}`);
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

      mediaId = await this.uploadVideo(creds.oauth_1a, videoBuffer);
    }

    // Create tweet
    console.warn(`[x-adapter] Creating tweet for ${content_id}`);

    const tweetResult = await retryWithBackoff(
      async () => {
        const body: Record<string, unknown> = { text: tweetText };
        if (mediaId) {
          body['media'] = { media_ids: [mediaId] };
        }

        const authHeader = buildAuthorizationHeader('POST', TWEET_URL, creds.oauth_1a);

        const resp = await fetch(TWEET_URL, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (resp.status === 429) throw new Error('RATE_LIMITED');
        if (resp.status === 401) throw new Error('UNAUTHORIZED');
        if (!resp.ok) {
          throw new Error(`X tweet failed (${resp.status}): ${await resp.text()}`);
        }

        return (await resp.json()) as TweetResponse;
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

    const tweetId = tweetResult.data.id;
    const postedAt = new Date().toISOString();
    const postUrl = `https://x.com/${creds.user_id}/status/${tweetId}`;

    console.warn(`[x-adapter] Published: ${postUrl}`);

    return {
      platform_post_id: tweetId,
      post_url: postUrl,
      posted_at: postedAt,
    };
  }

  /**
   * Upload video using X chunked media upload protocol.
   * INIT → APPEND (chunks) → FINALIZE → poll STATUS
   */
  private async uploadVideo(oauth: XOAuth1a, videoBuffer: Buffer): Promise<string> {
    // Step 1: INIT
    console.warn(`[x-adapter] Media upload INIT (${videoBuffer.length} bytes)`);

    const initParams: Record<string, string> = {
      command: 'INIT',
      total_bytes: String(videoBuffer.length),
      media_type: 'video/mp4',
      media_category: 'tweet_video',
    };

    const initAuth = buildAuthorizationHeader('POST', MEDIA_UPLOAD_URL, oauth, initParams);

    const initResp = await retryWithBackoff(
      async () => {
        const resp = await fetch(MEDIA_UPLOAD_URL, {
          method: 'POST',
          headers: {
            Authorization: initAuth,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(initParams),
        });

        if (!resp.ok) {
          throw new Error(`X media INIT failed (${resp.status}): ${await resp.text()}`);
        }

        return (await resp.json()) as MediaInitResponse;
      },
      { maxAttempts: 3, baseDelayMs: 2000 },
    );

    const mediaId = initResp.media_id_string;

    // Step 2: APPEND (chunked upload)
    const totalChunks = Math.ceil(videoBuffer.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, videoBuffer.length);
      const chunk = videoBuffer.subarray(start, end);

      console.warn(`[x-adapter] Media upload APPEND chunk ${i + 1}/${totalChunks}`);

      const appendParams: Record<string, string> = {
        command: 'APPEND',
        media_id: mediaId,
        segment_index: String(i),
      };

      await retryWithBackoff(
        async () => {
          // For APPEND, we need multipart/form-data with the binary chunk
          const boundary = `----XBoundary${randomBytes(8).toString('hex')}`;
          const parts: Buffer[] = [];

          // Add form fields
          for (const [key, value] of Object.entries(appendParams)) {
            parts.push(Buffer.from(
              `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
            ));
          }

          // Add media_data field
          parts.push(Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="media_data"\r\n\r\n`,
          ));
          parts.push(Buffer.from(chunk.toString('base64')));
          parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

          const body = Buffer.concat(parts);

          const authHeader = buildAuthorizationHeader('POST', MEDIA_UPLOAD_URL, oauth, appendParams);

          const resp = await fetch(MEDIA_UPLOAD_URL, {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body,
          });

          if (resp.status >= 500) throw new Error(`X media APPEND server error (${resp.status})`);
          if (!resp.ok && resp.status !== 204) {
            throw new Error(`X media APPEND failed (${resp.status}): ${await resp.text()}`);
          }
        },
        {
          maxAttempts: 5,
          baseDelayMs: 3000,
          isRetryable: (err) => {
            const msg = err instanceof Error ? err.message : '';
            return msg.includes('server error');
          },
        },
      );
    }

    // Step 3: FINALIZE
    console.warn(`[x-adapter] Media upload FINALIZE`);

    const finalizeParams: Record<string, string> = {
      command: 'FINALIZE',
      media_id: mediaId,
    };

    const finalizeAuth = buildAuthorizationHeader('POST', MEDIA_UPLOAD_URL, oauth, finalizeParams);

    const finalizeResp = await retryWithBackoff(
      async () => {
        const resp = await fetch(MEDIA_UPLOAD_URL, {
          method: 'POST',
          headers: {
            Authorization: finalizeAuth,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(finalizeParams),
        });

        if (!resp.ok) {
          throw new Error(`X media FINALIZE failed (${resp.status}): ${await resp.text()}`);
        }

        return (await resp.json()) as MediaFinalizeResponse;
      },
      { maxAttempts: 3, baseDelayMs: 2000 },
    );

    // Step 4: Poll STATUS if processing
    if (finalizeResp.processing_info) {
      await this.pollMediaStatus(oauth, mediaId, finalizeResp.processing_info.check_after_secs);
    }

    return mediaId;
  }

  /**
   * Poll media processing status until complete.
   */
  private async pollMediaStatus(
    oauth: XOAuth1a,
    mediaId: string,
    initialWaitSecs: number,
  ): Promise<void> {
    let waitSecs = initialWaitSecs;
    const maxPolls = 30;

    for (let i = 0; i < maxPolls; i++) {
      await new Promise((resolve) => setTimeout(resolve, waitSecs * 1000));

      const statusParams: Record<string, string> = {
        command: 'STATUS',
        media_id: mediaId,
      };

      const authHeader = buildAuthorizationHeader('GET', MEDIA_UPLOAD_URL, oauth, statusParams);

      const resp = await fetch(
        `${MEDIA_UPLOAD_URL}?command=STATUS&media_id=${mediaId}`,
        {
          method: 'GET',
          headers: { Authorization: authHeader },
        },
      );

      if (!resp.ok) continue;

      const data = (await resp.json()) as MediaStatusResponse;
      const state = data.processing_info?.state;

      if (state === 'succeeded') {
        console.warn(`[x-adapter] Media processing complete for ${mediaId}`);
        return;
      }

      if (state === 'failed') {
        throw new Error(
          `X media processing failed: ${data.processing_info?.error?.message ?? 'unknown'}`,
        );
      }

      // 'pending' or 'in_progress'
      waitSecs = data.processing_info?.check_after_secs ?? 5;
    }

    throw new Error(`X media processing timed out for ${mediaId}`);
  }

  async refreshToken(_accountId: string): Promise<boolean> {
    // X uses OAuth 1.0a — tokens don't expire unless revoked
    // No refresh needed
    return true;
  }
}
