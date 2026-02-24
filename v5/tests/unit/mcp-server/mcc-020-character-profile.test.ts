/**
 * Tests for create_character_profile
 */
import { createCharacterProfile } from '@/src/mcp-server/tools/curation/create-character-profile';
import { McpValidationError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

describe('create_character_profile', () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    await withClient(async (client) => {
      for (const id of createdIds) {
        await client.query(`DELETE FROM characters WHERE character_id = $1`, [id]);
      }
    });
  });

  test('creates character with required fields', async () => {
    const result = await createCharacterProfile({
      niche: 'beauty',
      target_market: 'US_18_25',
    });
    createdIds.push(result.character_id);

    expect(result).toHaveProperty('character_id');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('personality');
    expect(result.status).toBe('draft');
    expect(result.character_id).toMatch(/^CHR_\d{4}$/);
  });

  test('creates character with optional fields', async () => {
    const result = await createCharacterProfile({
      niche: 'tech',
      target_market: 'JP_25_35',
      personality_traits: ['friendly', 'energetic'],
      name_suggestion: 'TechGirl',
    });
    createdIds.push(result.character_id);

    expect(result.name).toBe('TechGirl');
    expect(result.personality).toHaveProperty('traits');
    expect((result.personality as Record<string, unknown>)['traits']).toEqual(['friendly', 'energetic']);
  });

  test('rejects empty niche', async () => {
    await expect(
      createCharacterProfile({ niche: '', target_market: 'US' }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty target_market', async () => {
    await expect(
      createCharacterProfile({ niche: 'beauty', target_market: '' }),
    ).rejects.toThrow(McpValidationError);
  });
});
