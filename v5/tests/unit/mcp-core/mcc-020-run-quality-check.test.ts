/**
 * TEST-MCP-020: run_quality_check — normal + not found
 * FEAT-MCC-020
 */
import { runQualityCheck } from '@/src/mcp-server/tools/production/run-quality-check';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';
import { McpNotFoundError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-020: run_quality_check', () => {
  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    await cleanupBaseData();
  });

  test('TEST-MCP-020a: returns quality check results with all check names', async () => {
    const result = await runQualityCheck({
      content_id: `${PREFIX}CNT_001`,
      video_url: 'https://example.com/video.mp4',
    });

    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('checks');
    expect(typeof result.passed).toBe('boolean');
    expect(Array.isArray(result.checks)).toBe(true);

    const checkNames = result.checks.map((c) => c.name);
    expect(checkNames).toContain('video_exists');
    expect(checkNames).toContain('content_exists');
    expect(checkNames).toContain('sections_complete');
  });

  test('TEST-MCP-020b: video_exists check passes when video_url is non-empty', async () => {
    const result = await runQualityCheck({
      content_id: `${PREFIX}CNT_001`,
      video_url: 'https://example.com/video.mp4',
    });

    const videoCheck = result.checks.find((c) => c.name === 'video_exists');
    expect(videoCheck).toBeDefined();
    expect(videoCheck!.passed).toBe(true);
  });

  test('TEST-MCP-020c: video_exists check fails when video_url is empty', async () => {
    const result = await runQualityCheck({
      content_id: `${PREFIX}CNT_001`,
      video_url: '',
    });

    const videoCheck = result.checks.find((c) => c.name === 'video_exists');
    expect(videoCheck).toBeDefined();
    expect(videoCheck!.passed).toBe(false);
  });

  test('TEST-MCP-020d: content_exists check passes for existing content', async () => {
    const result = await runQualityCheck({
      content_id: `${PREFIX}CNT_001`,
      video_url: 'https://example.com/video.mp4',
    });

    const contentCheck = result.checks.find((c) => c.name === 'content_exists');
    expect(contentCheck).toBeDefined();
    expect(contentCheck!.passed).toBe(true);
  });

  test('TEST-MCP-020e: throws McpNotFoundError for non-existent content', async () => {
    await expect(
      runQualityCheck({
        content_id: 'NONEXISTENT_CNT',
        video_url: 'https://example.com/video.mp4',
      }),
    ).rejects.toThrow(McpNotFoundError);
  });

  test('TEST-MCP-020f: each check has required fields', async () => {
    const result = await runQualityCheck({
      content_id: `${PREFIX}CNT_001`,
      video_url: 'https://example.com/video.mp4',
    });

    for (const check of result.checks) {
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('passed');
      expect(typeof check.name).toBe('string');
      expect(typeof check.passed).toBe('boolean');
    }
  });
});
