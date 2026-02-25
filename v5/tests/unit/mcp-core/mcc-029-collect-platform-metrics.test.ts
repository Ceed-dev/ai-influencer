/**
 * TEST-MCP-029: collect_youtube/tiktok/instagram/x_metrics — synthetic output + validation
 * FEAT-MCC-029
 */
import {
  collectYoutubeMetrics,
  collectTiktokMetrics,
  collectInstagramMetrics,
  collectXMetrics,
} from '@/src/mcp-server/tools/measurement/collect-platform-metrics';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-029: collect_platform_metrics', () => {
  test('TEST-MCP-029a: YouTube returns valid synthetic metrics', async () => {
    const result = await collectYoutubeMetrics({ platform_post_id: 'yt_video_abc' });

    expect(typeof result.views).toBe('number');
    expect(typeof result.likes).toBe('number');
    expect(typeof result.comments).toBe('number');
    expect(typeof result.shares).toBe('number');
    expect(typeof result.watch_time).toBe('number');
    expect(typeof result.completion_rate).toBe('number');
    expect(result.views).toBeGreaterThanOrEqual(1000);
    expect(result.completion_rate).toBeGreaterThanOrEqual(0.3);
    expect(result.completion_rate).toBeLessThanOrEqual(1.0);
  });

  test('TEST-MCP-029b: TikTok returns valid synthetic metrics', async () => {
    const result = await collectTiktokMetrics({ platform_post_id: 'tt_video_abc' });

    expect(typeof result.views).toBe('number');
    expect(typeof result.likes).toBe('number');
    expect(typeof result.saves).toBe('number');
    expect(typeof result.completion_rate).toBe('number');
    expect(result.views).toBeGreaterThanOrEqual(2000);
  });

  test('TEST-MCP-029c: Instagram returns valid synthetic metrics', async () => {
    const result = await collectInstagramMetrics({ platform_post_id: 'ig_post_abc' });

    expect(typeof result.views).toBe('number');
    expect(typeof result.reach).toBe('number');
    expect(typeof result.impressions).toBe('number');
    expect(typeof result.saves).toBe('number');
  });

  test('TEST-MCP-029d: X returns valid synthetic metrics', async () => {
    const result = await collectXMetrics({ platform_post_id: 'x_post_abc' });

    expect(typeof result.impressions).toBe('number');
    expect(typeof result.likes).toBe('number');
    expect(typeof result.retweets).toBe('number');
    expect(typeof result.replies).toBe('number');
    expect(typeof result.quotes).toBe('number');
  });

  test('TEST-MCP-029e: deterministic results for same input', async () => {
    const r1 = await collectYoutubeMetrics({ platform_post_id: 'same_id' });
    const r2 = await collectYoutubeMetrics({ platform_post_id: 'same_id' });
    expect(r1.views).toBe(r2.views);
    expect(r1.likes).toBe(r2.likes);
  });

  test('TEST-MCP-029f: throws McpValidationError for empty platform_post_id', async () => {
    await expect(
      collectYoutubeMetrics({ platform_post_id: '' }),
    ).rejects.toThrow(McpValidationError);

    await expect(
      collectTiktokMetrics({ platform_post_id: '' }),
    ).rejects.toThrow(McpValidationError);

    await expect(
      collectInstagramMetrics({ platform_post_id: '' }),
    ).rejects.toThrow(McpValidationError);

    await expect(
      collectXMetrics({ platform_post_id: '' }),
    ).rejects.toThrow(McpValidationError);
  });
});
