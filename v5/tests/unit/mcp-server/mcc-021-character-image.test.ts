/**
 * Tests for generate_character_image
 */
import { generateCharacterImage } from '@/src/mcp-server/tools/curation/generate-character-image';
import { McpValidationError, McpNotFoundError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const PREFIX = 'TCGI_';

describe('generate_character_image', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM characters WHERE character_id = '${PREFIX}CHR_001'`);
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('${PREFIX}CHR_001', 'Test Char Image', '00000000000000000000000000000000', 'draft')
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM characters WHERE character_id = '${PREFIX}CHR_001'`);
    });
  });

  test('generates placeholder image for valid character', async () => {
    const result = await generateCharacterImage({
      character_id: `${PREFIX}CHR_001`,
      appearance_description: 'Anime style girl with blue hair',
      style: 'anime',
    });
    expect(result).toHaveProperty('image_drive_id');
    expect(result).toHaveProperty('image_url');
    expect(typeof result.image_drive_id).toBe('string');
    expect(result.image_url).toContain('http');
  });

  test('works without style parameter', async () => {
    const result = await generateCharacterImage({
      character_id: `${PREFIX}CHR_001`,
      appearance_description: 'Realistic portrait',
    });
    expect(result).toHaveProperty('image_drive_id');
  });

  test('rejects invalid style', async () => {
    await expect(
      generateCharacterImage({
        character_id: `${PREFIX}CHR_001`,
        appearance_description: 'test',
        style: 'watercolor' as any,
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty character_id', async () => {
    await expect(
      generateCharacterImage({
        character_id: '',
        appearance_description: 'test',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws NotFoundError for nonexistent character', async () => {
    await expect(
      generateCharacterImage({
        character_id: 'NONEXISTENT_CHR',
        appearance_description: 'test',
      }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
