/**
 * TEST-MCP-017: start_lipsync — placeholder validation
 * FEAT-MCC-017
 */
import { startLipsync } from '@/src/mcp-server/tools/production/start-lipsync';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-017: start_lipsync', () => {
  test('TEST-MCP-017a: returns request_id for valid input', async () => {
    const result = await startLipsync({
      video_url: 'https://example.com/video.mp4',
      audio_url: 'https://example.com/audio.wav',
    });

    expect(result).toHaveProperty('request_id');
    expect(typeof result.request_id).toBe('string');
    expect(result.request_id).toMatch(/^lipsync_\d+$/);
  });

  test('TEST-MCP-017b: throws McpValidationError for empty video_url', async () => {
    await expect(
      startLipsync({
        video_url: '',
        audio_url: 'https://example.com/audio.wav',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-017c: throws McpValidationError for empty audio_url', async () => {
    await expect(
      startLipsync({
        video_url: 'https://example.com/video.mp4',
        audio_url: '',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-017d: throws McpValidationError for whitespace-only video_url', async () => {
    await expect(
      startLipsync({
        video_url: '   ',
        audio_url: 'https://example.com/audio.wav',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-017e: throws McpValidationError for whitespace-only audio_url', async () => {
    await expect(
      startLipsync({
        video_url: 'https://example.com/video.mp4',
        audio_url: '   ',
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
