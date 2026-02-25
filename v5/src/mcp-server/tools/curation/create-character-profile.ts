/**
 * MCI-020: create_character_profile
 * Spec: 04-agent-design.md S4.10 #7
 * Creates a new character profile with draft status.
 */
import type {
  CreateCharacterProfileInput,
  CreateCharacterProfileOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError } from '../../errors';

export async function createCharacterProfile(
  input: CreateCharacterProfileInput,
): Promise<CreateCharacterProfileOutput> {
  if (!input.niche || input.niche.trim().length === 0) {
    throw new McpValidationError('niche is required');
  }
  if (!input.target_market || input.target_market.trim().length === 0) {
    throw new McpValidationError('target_market is required');
  }

  const pool = getPool();

  // Generate character_id
  const countRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM characters`);
  const count = ((countRes.rows[0] as Record<string, unknown>)['cnt'] as number) + 1;
  const characterId = `CHR_${String(count).padStart(4, '0')}`;

  // Generate a name based on niche and suggestion
  const name = input.name_suggestion ?? `${input.niche}_char_${count}`;

  // Build personality JSON
  const personality: Record<string, unknown> = {
    niche: input.niche,
    target_market: input.target_market,
    traits: input.personality_traits ?? [],
  };

  // Placeholder voice_id (32-char hex, will be updated by select_voice_profile)
  const placeholderVoiceId = '00000000000000000000000000000000';

  const res = await pool.query(
    `INSERT INTO characters (character_id, name, personality, voice_id, status, created_by)
     VALUES ($1, $2, $3, $4, 'draft', 'curator')
     RETURNING character_id, name`,
    [characterId, name, JSON.stringify(personality), placeholderVoiceId],
  );

  const row = res.rows[0] as Record<string, unknown>;

  return {
    character_id: row['character_id'] as string,
    name: row['name'] as string,
    personality,
    status: 'draft',
  };
}
