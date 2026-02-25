/**
 * FEAT-MCC-014: get_character_info
 * Spec: 04-agent-design.md SS4.6 #3
 * Retrieves character information needed for video production.
 */
import type {
  GetCharacterInfoInput,
  GetCharacterInfoOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpNotFoundError } from '../../errors';

export async function getCharacterInfo(
  input: GetCharacterInfoInput,
): Promise<GetCharacterInfoOutput> {
  const pool = getPool();

  const res = await pool.query(
    `SELECT name, voice_id, image_drive_id, appearance
     FROM characters
     WHERE character_id = $1`,
    [input.character_id],
  );

  const row = res.rows[0] as {
    name: string;
    voice_id: string;
    image_drive_id: string | null;
    appearance: Record<string, unknown> | null;
  } | undefined;

  if (!row) {
    throw new McpNotFoundError(
      `Character not found: ${input.character_id}`,
    );
  }

  return {
    name: row.name,
    voice_id: row.voice_id,
    image_drive_id: row.image_drive_id ?? '',
    appearance: row.appearance ? JSON.stringify(row.appearance) : '',
  };
}
