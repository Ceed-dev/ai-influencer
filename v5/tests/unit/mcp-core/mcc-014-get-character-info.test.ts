/**
 * TEST-MCP-014: get_character_info — normal + not found
 * FEAT-MCC-014
 */
import { getCharacterInfo } from '@/src/mcp-server/tools/production/get-character-info';
import { seedBaseData, cleanupBaseData, PREFIX } from '../../helpers/mcp-seed';
import { McpNotFoundError } from '@/src/mcp-server/errors';

describe('FEAT-MCC-014: get_character_info', () => {
  beforeAll(async () => {
    await cleanupBaseData();
    await seedBaseData();
  });

  afterAll(async () => {
    await cleanupBaseData();
  });

  test('TEST-MCP-014a: returns character info for existing character', async () => {
    const result = await getCharacterInfo({
      character_id: `${PREFIX}CHR_001`,
    });

    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('voice_id');
    expect(result).toHaveProperty('image_drive_id');
    expect(result).toHaveProperty('appearance');

    expect(typeof result.name).toBe('string');
    expect(typeof result.voice_id).toBe('string');
    expect(typeof result.image_drive_id).toBe('string');
    expect(typeof result.appearance).toBe('string');

    expect(result.name).toBe('Test Char 1');
    expect(result.voice_id).toBe('abc123def456abc123def456abc12345');
  });

  test('TEST-MCP-014b: throws McpNotFoundError for non-existent character', async () => {
    await expect(
      getCharacterInfo({ character_id: 'NONEXISTENT_CHR' }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
