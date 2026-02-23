/**
 * FEAT-MCC-029: collect_youtube_metrics / collect_tiktok_metrics /
 *               collect_instagram_metrics / collect_x_metrics
 * Spec: 04-agent-design.md §4.8 #2-5
 * Placeholder implementations returning synthetic metrics.
 */
import type {
  CollectYoutubeMetricsInput,
  CollectYoutubeMetricsOutput,
  CollectTiktokMetricsInput,
  CollectTiktokMetricsOutput,
  CollectInstagramMetricsInput,
  CollectInstagramMetricsOutput,
  CollectXMetricsInput,
  CollectXMetricsOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors';

function validatePostId(platform_post_id: string, platform: string): void {
  if (!platform_post_id || platform_post_id.trim() === '') {
    throw new McpValidationError(`platform_post_id is required for ${platform} metrics collection`);
  }
}

/** Deterministic seed from string for repeatable synthetic data */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash | 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export async function collectYoutubeMetrics(
  input: CollectYoutubeMetricsInput,
): Promise<CollectYoutubeMetricsOutput> {
  validatePostId(input.platform_post_id, 'YouTube');
  const seed = hashCode(input.platform_post_id);

  return {
    views: 1000 + (seed % 9000),
    likes: 50 + (seed % 450),
    comments: 5 + (seed % 95),
    shares: 2 + (seed % 48),
    watch_time: 300 + (seed % 2700),
    completion_rate: Number((0.3 + (seed % 70) / 100).toFixed(4)),
  };
}

export async function collectTiktokMetrics(
  input: CollectTiktokMetricsInput,
): Promise<CollectTiktokMetricsOutput> {
  validatePostId(input.platform_post_id, 'TikTok');
  const seed = hashCode(input.platform_post_id);

  return {
    views: 2000 + (seed % 18000),
    likes: 100 + (seed % 900),
    comments: 10 + (seed % 190),
    shares: 5 + (seed % 95),
    saves: 3 + (seed % 47),
    completion_rate: Number((0.25 + (seed % 75) / 100).toFixed(4)),
  };
}

export async function collectInstagramMetrics(
  input: CollectInstagramMetricsInput,
): Promise<CollectInstagramMetricsOutput> {
  validatePostId(input.platform_post_id, 'Instagram');
  const seed = hashCode(input.platform_post_id);

  return {
    views: 1500 + (seed % 13500),
    likes: 75 + (seed % 675),
    comments: 8 + (seed % 142),
    saves: 4 + (seed % 46),
    reach: 1200 + (seed % 10800),
    impressions: 1800 + (seed % 16200),
  };
}

export async function collectXMetrics(
  input: CollectXMetricsInput,
): Promise<CollectXMetricsOutput> {
  validatePostId(input.platform_post_id, 'X');
  const seed = hashCode(input.platform_post_id);

  return {
    impressions: 800 + (seed % 7200),
    likes: 30 + (seed % 270),
    retweets: 5 + (seed % 45),
    replies: 2 + (seed % 28),
    quotes: 1 + (seed % 9),
  };
}
