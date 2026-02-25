/**
 * Tests for select_voice_profile
 */
import { selectVoiceProfile } from '@/src/mcp-server/tools/curation/select-voice-profile';
import { McpValidationError, McpNotFoundError } from '@/src/mcp-server/errors';
import { withClient } from '../../helpers/db';

const PREFIX = 'TSVP_';

describe('select_voice_profile', () => {
  beforeAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM characters WHERE character_id = '${PREFIX}CHR_001'`);
      await client.query(`
        INSERT INTO characters (character_id, name, voice_id, status)
        VALUES ('${PREFIX}CHR_001', 'Test Char Voice', '00000000000000000000000000000000', 'draft')
      `);
    });
  });

  afterAll(async () => {
    await withClient(async (client) => {
      await client.query(`DELETE FROM characters WHERE character_id = '${PREFIX}CHR_001'`);
    });
  });

  test('selects voice profile for valid character', async () => {
    const result = await selectVoiceProfile({
      character_id: `${PREFIX}CHR_001`,
      personality: { tone: 'cheerful' },
      gender: 'female',
      age_range: '20-30',
      language: 'en',
    });
    expect(result).toHaveProperty('voice_id');
    expect(result).toHaveProperty('voice_name');
    expect(result).toHaveProperty('sample_url');
    expect(result.voice_id).toHaveLength(32);
  });

  test('works with minimal parameters', async () => {
    const result = await selectVoiceProfile({
      character_id: `${PREFIX}CHR_001`,
      personality: {},
      language: 'jp',
    });
    expect(result).toHaveProperty('voice_id');
    expect(result.voice_id).toHaveLength(32);
  });

  test('rejects empty character_id', async () => {
    await expect(
      selectVoiceProfile({
        character_id: '',
        personality: {},
        language: 'en',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('rejects empty language', async () => {
    await expect(
      selectVoiceProfile({
        character_id: `${PREFIX}CHR_001`,
        personality: {},
        language: '',
      }),
    ).rejects.toThrow(McpValidationError);
  });

  test('throws NotFoundError for nonexistent character', async () => {
    await expect(
      selectVoiceProfile({
        character_id: 'NONEXISTENT_CHR_999',
        personality: {},
        language: 'en',
      }),
    ).rejects.toThrow(McpNotFoundError);
  });
});
