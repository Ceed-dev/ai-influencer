/**
 * FEAT-DB-007: characters.voice_id NOT NULL + VARCHAR(32)
 * Tests: TEST-DB-009, TEST-DB-010
 */
import { withClient } from '../../helpers/db';

let counter = 0;
const uniqueId = () => `CT${(++counter).toString().padStart(3, '0')}`;

describe('characters table constraints', () => {
  afterAll(async () => {
    await withClient(async (c) => {
      await c.query("DELETE FROM accounts WHERE character_id IN (SELECT character_id FROM characters WHERE character_id LIKE 'CT%')");
      await c.query("DELETE FROM characters WHERE character_id LIKE 'CT%'");
    });
  });

  // TEST-DB-009: voice_id NOT NULL
  test('TEST-DB-009: voice_id NOT NULL enforced', async () => {
    await withClient(async (c) => {
      const id = uniqueId();
      await expect(
        c.query("INSERT INTO characters (character_id, name) VALUES ($1, 'TestChar')", [id])
      ).rejects.toThrow(/null value in column "voice_id"/);
    });
  });

  // TEST-DB-010: voice_id VARCHAR(32)
  test('TEST-DB-010: voice_id max 32 characters', async () => {
    await withClient(async (c) => {
      const id32 = uniqueId();
      const voice32 = 'a'.repeat(32);
      await c.query("INSERT INTO characters (character_id, name, voice_id) VALUES ($1, 'TestChar32', $2)", [id32, voice32]);

      const id33 = uniqueId();
      const voice33 = 'a'.repeat(33);
      await expect(
        c.query("INSERT INTO characters (character_id, name, voice_id) VALUES ($1, 'TestChar33', $2)", [id33, voice33])
      ).rejects.toThrow(/value too long for type character varying\(32\)/);
    });
  });
});
