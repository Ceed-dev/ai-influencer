/**
 * TEST-MCP-015: start_video_generation — placeholder validation
 * FEAT-MCC-015
 */
import { startVideoGeneration } from '@/src/mcp-server/tools/production/start-video-generation';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-015: start_video_generation', () => {
  test('TEST-MCP-015a: returns request_id with correct prefix', async () => {
    const result = await startVideoGeneration({
      image_url: 'https://example.com/image.png',
      motion_data: { type: 'zoom_in', duration: 3 },
      section: 'hook',
    });

    expect(result).toHaveProperty('request_id');
    expect(typeof result.request_id).toBe('string');
    expect(result.request_id).toMatch(/^vgen_\d+_hook$/);
  });

  test('TEST-MCP-015b: includes section name in request_id', async () => {
    const result = await startVideoGeneration({
      image_url: 'https://example.com/image.png',
      motion_data: {},
      section: 'cta',
    });

    expect(result.request_id).toContain('_cta');
  });

  test('TEST-MCP-015c: throws McpValidationError for empty image_url', async () => {
    await expect(
      startVideoGeneration({
        image_url: '',
        motion_data: {},
        section: 'hook',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-015d: throws McpValidationError for whitespace-only image_url', async () => {
    await expect(
      startVideoGeneration({
        image_url: '   ',
        motion_data: {},
        section: 'hook',
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
