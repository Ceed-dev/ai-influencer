/**
 * YouTube Analytics API adapter
 * Spec: 04-agent-design.md §4.8 #2, 02-architecture.md §12.1
 *
 * Uses YouTube Analytics API v2 to fetch video metrics.
 * OAuth 2.0 with refresh_token for access_token renewal.
 */
import type { CollectYoutubeMetricsOutput } from '../../../../types/mcp-tools.js';
import type { OAuthCredentials } from './types.js';
import { handleApiResponse } from './types.js';

/**
 * Refresh YouTube OAuth2 access token using refresh_token.
 * POST https://oauth2.googleapis.com/token
 */
export async function refreshYouTubeToken(
  oauth: OAuthCredentials,
): Promise<string> {
  const { client_id, client_secret, refresh_token } = oauth;
  if (!client_id || !client_secret || !refresh_token) {
    throw new Error('Missing YouTube OAuth credentials (client_id, client_secret, refresh_token)');
  }

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id,
      client_secret,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`YouTube token refresh failed (${resp.status}): ${body}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const accessToken = data['access_token'] as string | undefined;
  if (!accessToken) {
    throw new Error('YouTube token refresh response missing access_token');
  }
  return accessToken;
}

/**
 * Fetch YouTube video metrics from the YouTube Analytics API v2.
 * GET https://youtubeanalytics.googleapis.com/v2/reports
 */
export async function fetchYouTubeMetrics(
  accessToken: string,
  platformPostId: string,
  videoDurationSeconds?: number,
): Promise<CollectYoutubeMetricsOutput> {
  const endDate = new Date().toISOString().split('T')[0]!;
  const startDate = '2020-01-01';

  const params = new URLSearchParams({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched,likes,comments,shares',
    filters: `video==${platformPostId}`,
  });

  const url = `https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await handleApiResponse(resp, 'YouTube');
  const rows = data['rows'] as number[][] | undefined;

  if (!rows || rows.length === 0) {
    return { views: 0, likes: 0, comments: 0, shares: 0, watch_time: 0, completion_rate: 0 };
  }

  const row = rows[0]!;
  const views = row[0] ?? 0;
  const estimatedMinutesWatched = row[1] ?? 0;
  const likes = row[2] ?? 0;
  const comments = row[3] ?? 0;
  const shares = row[4] ?? 0;
  const watchTimeSeconds = Math.round(estimatedMinutesWatched * 60);

  // completion_rate = total_watch_time / (views * video_duration)
  let completionRate = 0;
  if (views > 0 && videoDurationSeconds && videoDurationSeconds > 0) {
    completionRate = Math.min(1, (watchTimeSeconds) / (views * videoDurationSeconds));
  } else if (views > 0) {
    // Approximate: assume ~60s average video when duration unknown
    completionRate = Math.min(1, watchTimeSeconds / (views * 60));
  }

  return {
    views,
    likes,
    comments,
    shares,
    watch_time: watchTimeSeconds,
    completion_rate: Number(completionRate.toFixed(4)),
  };
}
