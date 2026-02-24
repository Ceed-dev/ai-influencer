/**
 * TikTok Analytics API adapter
 * Spec: 04-agent-design.md §4.8 #3, 02-architecture.md §12.1
 *
 * Uses TikTok Content Posting API v2 for video query.
 * OAuth 2.0 with refresh_token for access_token renewal.
 */
import type { CollectTiktokMetricsOutput } from '../../../../types/mcp-tools.js';
import type { OAuthCredentials } from './types.js';
import { handleApiResponse } from './types.js';

/**
 * Refresh TikTok OAuth2 access token using refresh_token.
 * POST https://open.tiktokapis.com/v2/oauth/token/
 */
export async function refreshTikTokToken(
  oauth: OAuthCredentials,
): Promise<string> {
  const { client_key, client_secret, refresh_token } = oauth;
  if (!client_key || !client_secret || !refresh_token) {
    throw new Error('Missing TikTok OAuth credentials (client_key, client_secret, refresh_token)');
  }

  const resp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key,
      client_secret,
      grant_type: 'refresh_token',
      refresh_token,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`TikTok token refresh failed (${resp.status}): ${body}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const accessToken = data['access_token'] as string | undefined;
  if (!accessToken) {
    throw new Error('TikTok token refresh response missing access_token');
  }
  return accessToken;
}

/**
 * Fetch TikTok video metrics using Video Query API.
 * POST https://open.tiktokapis.com/v2/video/query/?fields=like_count,comment_count,share_count,view_count
 */
export async function fetchTikTokMetrics(
  accessToken: string,
  platformPostId: string,
): Promise<CollectTiktokMetricsOutput> {
  const fields = 'like_count,comment_count,share_count,view_count';
  const url = `https://open.tiktokapis.com/v2/video/query/?fields=${fields}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filters: {
        video_ids: [platformPostId],
      },
    }),
  });

  const data = await handleApiResponse(resp, 'TikTok');

  // TikTok API returns { data: { videos: [...] } }
  const apiData = data['data'] as Record<string, unknown> | undefined;
  const videos = (apiData?.['videos'] ?? []) as Array<Record<string, unknown>>;

  if (videos.length === 0) {
    return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, completion_rate: 0 };
  }

  const video = videos[0]!;
  const views = (video['view_count'] as number) ?? 0;
  const likes = (video['like_count'] as number) ?? 0;
  const comments = (video['comment_count'] as number) ?? 0;
  const shares = (video['share_count'] as number) ?? 0;
  // TikTok API doesn't always expose saves directly
  const saves = (video['collect_count'] as number) ?? 0;
  // Duration in seconds for completion rate
  const duration = (video['duration'] as number) ?? 0;
  const avgWatchTime = (video['average_time_watched'] as number) ?? 0;

  let completionRate = 0;
  if (duration > 0 && avgWatchTime > 0) {
    completionRate = Math.min(1, avgWatchTime / duration);
  }

  return {
    views,
    likes,
    comments,
    shares,
    saves,
    completion_rate: Number(completionRate.toFixed(4)),
  };
}
