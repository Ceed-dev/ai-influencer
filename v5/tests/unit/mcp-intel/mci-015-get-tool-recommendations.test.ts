/**
 * MCI-015: get_tool_recommendations
 * Tests: recipe recommendation
 */
import { getToolRecommendations } from '../../../src/mcp-server/tools/tool-knowledge/get-tool-recommendations';
import { McpValidationError } from '../../../src/mcp-server/errors';

describe('MCI-015: get_tool_recommendations', () => {
  test('rejects invalid platform', async () => {
    await expect(
      getToolRecommendations({
        content_requirements: {
          character_id: 'CHR_0001',
          niche: 'beauty',
          platform: 'facebook' as any,
          quality_target: 0.8,
        },
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty character_id', async () => {
    await expect(
      getToolRecommendations({
        content_requirements: {
          character_id: '',
          niche: 'beauty',
          platform: 'youtube',
          quality_target: 0.8,
        },
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('returns recipe with defaults if no recipes in DB', async () => {
    const result = await getToolRecommendations({
      content_requirements: {
        character_id: 'CHR_0001',
        niche: 'beauty',
        platform: 'youtube',
        quality_target: 0.8,
      },
    });
    expect(result).toHaveProperty('recipe');
    expect(result.recipe).toHaveProperty('video_gen');
    expect(result.recipe).toHaveProperty('tts');
    expect(result.recipe).toHaveProperty('lipsync');
    expect(result.recipe).toHaveProperty('concat');
    expect(typeof result.confidence).toBe('number');
  });
});
