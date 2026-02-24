/**
 * Instagram Insights API adapter
 * Spec: 04-agent-design.md §4.8 #4, 02-architecture.md §12.1
 *
 * Uses Instagram Graph API v21.0 to fetch media insights.
 * Long-lived token stored in auth_credentials.oauth.long_lived_token.
 */
import type { CollectInstagramMetricsOutput } from '../../../../types/mcp-tools.js';
import type { OAuthCredentials } from './types.js';
import { handleApiResponse } from './types.js';

/**
 * Refresh Instagram long-lived token.
 * GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={token}
 */
export async function refreshInstagramToken(
  oauth: OAuthCredentials,
): Promise<string> {
  const token = oauth.long_lived_token;
  if (!token) {
    throw new Error('Missing Instagram long_lived_token');
  }

  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: token,
  });

  const resp = await fetch(
    `https://graph.instagram.com/refresh_access_token?${params.toString()}`,
  );

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Instagram token refresh failed (${resp.status}): ${body}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const newToken = data['access_token'] as string | undefined;
  if (!newToken) {
    throw new Error('Instagram token refresh response missing access_token');
  }
  return newToken;
}

/**
 * Fetch Instagram media insights.
 * First tries the Reels insights endpoint, then falls back to basic media fields.
 */
export async function fetchInstagramMetrics(
  accessToken: string,
  platformPostId: string,
): Promise<CollectInstagramMetricsOutput> {
  // Try Reels insights first (provides richer data)
  const insightsResult = await tryReelsInsights(accessToken, platformPostId);
  if (insightsResult) return insightsResult;

  // Fall back to basic media fields
  return fetchBasicMediaFields(accessToken, platformPostId);
}

/**
 * Try Reels insights endpoint.
 * GET https://graph.instagram.com/v21.0/{media-id}/insights?metric=impressions,reach,likes,comments,saved,plays
 */
async function tryReelsInsights(
  accessToken: string,
  platformPostId: string,
): Promise<CollectInstagramMetricsOutput | null> {
  try {
    const metrics = 'impressions,reach,likes,comments,saved,plays';
    const url = `https://graph.instagram.com/v21.0/${platformPostId}/insights?metric=${metrics}&access_token=${accessToken}`;
    const resp = await fetch(url);

    if (!resp.ok) return null;

    const data = (await resp.json()) as Record<string, unknown>;
    const insightsData = data['data'] as Array<Record<string, unknown>> | undefined;
    if (!insightsData || insightsData.length === 0) return null;

    const metricsMap: Record<string, number> = {};
    for (const item of insightsData) {
      const name = item['name'] as string;
      const values = item['values'] as Array<Record<string, unknown>> | undefined;
      if (values && values.length > 0) {
        metricsMap[name] = (values[0]!['value'] as number) ?? 0;
      }
    }

    return {
      views: metricsMap['plays'] ?? metricsMap['impressions'] ?? 0,
      likes: metricsMap['likes'] ?? 0,
      comments: metricsMap['comments'] ?? 0,
      saves: metricsMap['saved'] ?? 0,
      reach: metricsMap['reach'] ?? 0,
      impressions: metricsMap['impressions'] ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch basic media fields.
 * GET https://graph.instagram.com/v21.0/{media-id}?fields=impressions,reach,like_count,comments_count,saved
 */
async function fetchBasicMediaFields(
  accessToken: string,
  platformPostId: string,
): Promise<CollectInstagramMetricsOutput> {
  const fields = 'like_count,comments_count,impressions,reach';
  const url = `https://graph.instagram.com/v21.0/${platformPostId}?fields=${fields}&access_token=${accessToken}`;
  const resp = await fetch(url);

  const data = await handleApiResponse(resp, 'Instagram');

  return {
    views: (data['impressions'] as number) ?? 0,
    likes: (data['like_count'] as number) ?? 0,
    comments: (data['comments_count'] as number) ?? 0,
    saves: 0, // Not available in basic fields endpoint
    reach: (data['reach'] as number) ?? 0,
    impressions: (data['impressions'] as number) ?? 0,
  };
}
