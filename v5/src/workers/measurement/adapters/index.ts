/**
 * Measurement analytics adapter registry
 * Spec: 04-agent-design.md §4.8
 *
 * Re-exports all platform-specific analytics adapters.
 */
export type { OAuthCredentials } from './types.js';
export { RateLimitError, UnauthorizedError, ClientError, isRetryableError } from './types.js';

export { refreshYouTubeToken, fetchYouTubeMetrics } from './youtube-analytics.js';
export { refreshTikTokToken, fetchTikTokMetrics } from './tiktok-analytics.js';
export { refreshInstagramToken, fetchInstagramMetrics } from './instagram-insights.js';
export { fetchXMetrics } from './x-analytics.js';
