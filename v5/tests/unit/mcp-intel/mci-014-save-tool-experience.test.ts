/**
 * MCI-014: save_tool_experience
 * Tests: INSERT into tool_experiences
 */
import { saveToolExperience } from '../../../src/mcp-server/tools/tool-knowledge/save-tool-experience';
import { McpValidationError, McpNotFoundError } from '../../../src/mcp-server/errors';

describe('MCI-014: save_tool_experience', () => {
  test('rejects empty tool_combination', async () => {
    await expect(
      saveToolExperience({
        tool_combination: [],
        content_id: 'CNT_202601_0001',
        quality_score: 0.8,
        notes: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects quality_score out of range', async () => {
    await expect(
      saveToolExperience({
        tool_combination: ['kling_v2'],
        content_id: 'CNT_202601_0001',
        quality_score: 1.5,
        notes: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws not found for non-existent tool', async () => {
    await expect(
      saveToolExperience({
        tool_combination: ['nonexistent_tool_xyz'],
        content_id: 'CNT_202601_0001',
        quality_score: 0.8,
        notes: 'test',
      }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
