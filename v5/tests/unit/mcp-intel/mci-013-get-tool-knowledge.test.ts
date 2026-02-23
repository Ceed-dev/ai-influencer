/**
 * MCI-013: get_tool_knowledge
 * Tests: query tool_catalog
 */
import { getToolKnowledge } from '../../../src/mcp-server/tools/tool-knowledge/get-tool-knowledge';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-013: get_tool_knowledge', () => {
  test('rejects invalid category', async () => {
    await expect(
      getToolKnowledge({ category: 'invalid' as any }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns tools array with all valid categories', async () => {
    for (const category of ['video_gen', 'tts', 'lipsync', 'image_gen'] as const) {
      const result = await getToolKnowledge({ category });
      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
    }
  });

  test('returns tools with name filter', async () => {
    const result = await getToolKnowledge({ tool_name: 'kling' });
    expect(result).toHaveProperty('tools');
    expect(Array.isArray(result.tools)).toBe(true);
  });
});
