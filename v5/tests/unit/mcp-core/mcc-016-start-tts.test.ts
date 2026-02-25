/**
 * TEST-MCP-016: start_tts — placeholder validation
 * FEAT-MCC-016
 */
import { startTts } from '@/src/mcp-server/tools/production/start-tts';
import { McpValidationError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-016: start_tts', () => {
  test('TEST-MCP-016a: returns audio_url placeholder for valid input', async () => {
    const result = await startTts({
      text: 'Hello world',
      voice_id: 'abc123def456abc123def456abc12345',
      language: 'en',
    });

    expect(result).toHaveProperty('audio_url');
    expect(typeof result.audio_url).toBe('string');
    expect(result.audio_url).toMatch(/^tts_placeholder_\d+$/);
  });

  test('TEST-MCP-016b: accepts jp language', async () => {
    const result = await startTts({
      text: 'Hello world',
      voice_id: 'abc123def456abc123def456abc12345',
      language: 'jp',
    });

    expect(result.audio_url).toMatch(/^tts_placeholder_\d+$/);
  });

  test('TEST-MCP-016c: throws McpValidationError for empty voice_id', async () => {
    await expect(
      startTts({
        text: 'Hello world',
        voice_id: '',
        language: 'en',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-016d: throws McpValidationError for invalid language', async () => {
    await expect(
      startTts({
        text: 'Hello world',
        voice_id: 'abc123def456abc123def456abc12345',
        language: 'fr' as any,
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('TEST-MCP-016e: throws McpValidationError for whitespace-only voice_id', async () => {
    await expect(
      startTts({
        text: 'Hello world',
        voice_id: '   ',
        language: 'en',
      }),
    ).rejects.toThrow(McpValidationError);
  });
});
