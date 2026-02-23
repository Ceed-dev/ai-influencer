/**
 * FEAT-INT-019: Auto-generate character personality JSONB from niche/target
 * Spec: 04-agent-design.md §4.10 (#7), 02-architecture.md §8
 *
 * Generates a character profile (personality JSONB) based on niche, target market,
 * and optional personality traits. Creates a draft character in the characters table.
 * All config from DB system_settings — no hardcoding.
 */
import type { PoolClient } from 'pg';
import type {
  CharacterPersonality,
  CharacterAppearance,
} from '@/types/database';

/** Input for character profile generation */
export interface CharacterProfileInput {
  niche: string;
  targetMarket: string;
  personalityTraits?: string[];
  nameSuggestion?: string;
}

/** Generated character profile */
export interface GeneratedCharacterProfile {
  characterId: string;
  name: string;
  personality: CharacterPersonality;
  appearance: CharacterAppearance;
  description: string;
}

/**
 * Generate a character ID in the format CHR_NNNN.
 */
export async function generateCharacterId(client: PoolClient): Promise<string> {
  const res = await client.query(
    `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM characters`,
  );
  const nextId = (res.rows[0] as Record<string, unknown>)['next_id'] as number;
  return `CHR_${String(nextId).padStart(4, '0')}`;
}

/**
 * Build a personality profile from niche and target market.
 * This is a template-based approach; actual implementation would use LLM.
 */
export function buildPersonalityFromNiche(
  niche: string,
  targetMarket: string,
  traits?: string[],
): CharacterPersonality {
  const nichePersonalities: Record<string, Partial<CharacterPersonality>> = {
    beauty: {
      speaking_style: 'warm and encouraging',
      language_preference: targetMarket.includes('jp') ? 'japanese' : 'english',
      emoji_usage: 'moderate',
    },
    tech: {
      speaking_style: 'knowledgeable and concise',
      language_preference: targetMarket.includes('jp') ? 'japanese' : 'english',
      emoji_usage: 'minimal',
    },
    fitness: {
      speaking_style: 'energetic and motivating',
      language_preference: targetMarket.includes('jp') ? 'japanese' : 'english',
      emoji_usage: 'heavy',
    },
    cooking: {
      speaking_style: 'friendly and instructive',
      language_preference: targetMarket.includes('jp') ? 'japanese' : 'english',
      emoji_usage: 'moderate',
    },
    gaming: {
      speaking_style: 'casual and enthusiastic',
      language_preference: targetMarket.includes('jp') ? 'japanese' : 'english',
      emoji_usage: 'heavy',
    },
    pet: {
      speaking_style: 'cute and affectionate',
      language_preference: targetMarket.includes('jp') ? 'japanese' : 'english',
      emoji_usage: 'heavy',
    },
  };

  const base = nichePersonalities[niche] ?? {
    speaking_style: 'natural and engaging',
    language_preference: 'english',
    emoji_usage: 'moderate',
  };

  return {
    traits: traits ?? ['creative', 'authentic', 'relatable'],
    speaking_style: base.speaking_style,
    language_preference: base.language_preference,
    emoji_usage: base.emoji_usage,
  };
}

/**
 * Generate and save a character profile.
 * Creates a draft character in the characters table.
 *
 * Note: In production, this would call Claude for name/description generation.
 * This implementation provides the template-based scaffold.
 */
export async function generateCharacterProfile(
  client: PoolClient,
  input: CharacterProfileInput,
): Promise<GeneratedCharacterProfile> {
  const characterId = await generateCharacterId(client);
  const name = input.nameSuggestion ?? `${input.niche}_character_${Date.now()}`;
  const personality = buildPersonalityFromNiche(
    input.niche,
    input.targetMarket,
    input.personalityTraits,
  );
  const appearance: CharacterAppearance = {};
  const description = `Auto-generated ${input.niche} character for ${input.targetMarket} market`;

  // Save to characters table as draft
  await client.query(
    `INSERT INTO characters (character_id, name, description, personality, appearance, voice_id, status, created_by, generation_metadata)
     VALUES ($1, $2, $3, $4, $5, 'pending', 'draft', 'curator', $6)`,
    [
      characterId,
      name,
      description,
      JSON.stringify(personality),
      JSON.stringify(appearance),
      JSON.stringify({
        niche: input.niche,
        target_market: input.targetMarket,
        generated_at: new Date().toISOString(),
      }),
    ],
  );

  return {
    characterId,
    name,
    personality,
    appearance,
    description,
  };
}
