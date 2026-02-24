/**
 * X (Twitter) Analytics API adapter
 * Spec: 04-agent-design.md §4.8 #5, 02-architecture.md §12.1
 *
 * Uses X API v2 to fetch tweet public metrics.
 * OAuth 1.0a — tokens don't expire unless revoked, no refresh needed.
 */
import crypto from 'node:crypto';
import type { CollectXMetricsOutput } from '../../../../types/mcp-tools.js';
import type { OAuthCredentials } from './types.js';
import { handleApiResponse } from './types.js';

/**
 * Percent-encode a string per RFC 5849.
 */
function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Build OAuth 1.0a Authorization header for X API requests.
 */
export function buildOAuth1Header(
  method: string,
  url: string,
  queryParams: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  token: string,
  tokenSecret: string,
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  };

  // Combine query params + oauth params for signature
  const allParams: Record<string, string> = { ...queryParams, ...oauthParams };

  // Sort and encode parameter string
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k]!)}`)
    .join('&');

  // Signature base string
  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;

  // Signing key
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  // HMAC-SHA1 signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseString)
    .digest('base64');

  oauthParams['oauth_signature'] = signature;

  // Build header string
  const headerParts = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k]!)}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

/**
 * Fetch X tweet metrics using API v2.
 * GET https://api.twitter.com/2/tweets/{id}?tweet.fields=public_metrics
 *
 * Uses OAuth 1.0a authentication (no token refresh needed).
 */
export async function fetchXMetrics(
  oauth: OAuthCredentials,
  tweetId: string,
): Promise<CollectXMetricsOutput> {
  const { api_key, api_secret, access_token, access_token_secret } = oauth;
  if (!api_key || !api_secret || !access_token || !access_token_secret) {
    throw new Error('Missing X OAuth 1.0a credentials (api_key, api_secret, access_token, access_token_secret)');
  }

  const baseUrl = `https://api.twitter.com/2/tweets/${tweetId}`;
  const queryParams: Record<string, string> = { 'tweet.fields': 'public_metrics' };

  const authHeader = buildOAuth1Header(
    'GET',
    baseUrl,
    queryParams,
    api_key,
    api_secret,
    access_token,
    access_token_secret,
  );

  const urlWithParams = `${baseUrl}?tweet.fields=public_metrics`;
  const resp = await fetch(urlWithParams, {
    headers: { Authorization: authHeader },
  });

  const data = await handleApiResponse(resp, 'X');

  const tweetData = data['data'] as Record<string, unknown> | undefined;
  const publicMetrics = (tweetData?.['public_metrics'] ?? {}) as Record<string, unknown>;

  return {
    impressions: (publicMetrics['impression_count'] as number) ?? 0,
    likes: (publicMetrics['like_count'] as number) ?? 0,
    retweets: (publicMetrics['retweet_count'] as number) ?? 0,
    replies: (publicMetrics['reply_count'] as number) ?? 0,
    quotes: (publicMetrics['quote_count'] as number) ?? 0,
  };
}
