/**
 * FEAT-INT-019: Auto-generate character personality JSONB from niche/target
 * Spec: 04-agent-design.md §4.10 (#7), 02-architecture.md §8
 *
 * Generates a character profile (personality JSONB) based on niche, target market,
 * and optional personality traits. Creates a draft character in the characters table.
 * All config from DB system_settings — no hardcoding.
 *
 * Primary: Claude Sonnet LLM for personality generation.
 * Fallback: template-based generation when API key is unavailable.
 */
import type { PoolClient } from 'pg';
import type {
  CharacterPersonality,
  CharacterAppearance,
} from '@/types/database';
import { ChatAnthropic } from '@langchain/anthropic';
import { getSetting } from '../../lib/settings.js';
import { retryWithBackoff } from '../../lib/retry.js';

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
 * Build a personality profile from niche and target market via Claude Sonnet LLM.
 * Falls back to template-based approach if LLM call fails.
 */
export async function buildPersonalityFromNiche(
  niche: string,
  targetMarket: string,
  traits?: string[],
): Promise<CharacterPersonality> {
  try {
    const llmResult = await generatePersonalityViaLlm(niche, targetMarket, traits);
    if (llmResult) return llmResult;
  } catch (err) {
    console.warn(
      `[character-profile-gen] LLM personality generation failed, using template fallback: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return buildPersonalityTemplate(niche, targetMarket, traits);
}

/**
 * Generate personality via Claude Sonnet LLM.
 * Returns null if API key is unavailable or LLM call fails.
 */
async function generatePersonalityViaLlm(
  niche: string,
  targetMarket: string,
  traits?: string[],
): Promise<CharacterPersonality | null> {
  let apiKey: string;
  try {
    apiKey = String(await getSetting('CRED_ANTHROPIC_API_KEY'));
  } catch {
    return null;
  }
  if (!apiKey) return null;

  const llm = new ChatAnthropic({
    model: 'claude-sonnet-4-5-20250514',
    anthropicApiKey: apiKey,
    maxTokens: 1024,
    temperature: 0,
  });

  const systemPrompt = `You are a character design specialist for social media AI influencers. Generate detailed personality profiles that feel authentic and engaging for the target audience.

Return ONLY valid JSON matching this exact schema:
{
  "traits": ["trait1", "trait2", ...],  // 5-8 personality traits
  "speaking_style": "description",       // e.g. "warm and encouraging"
  "language_preference": "language",     // "english" or "japanese"
  "emoji_usage": "level",               // "minimal", "moderate", or "heavy"
  "catchphrase": "optional catchphrase"  // a signature phrase (optional)
}`;

  const userPrompt = `Create a character personality profile for:
- Niche: ${niche}
- Target Market: ${targetMarket}
- Language: ${targetMarket.includes('jp') ? 'Japanese' : 'English'}
${traits && traits.length > 0 ? `- Desired traits: ${traits.join(', ')}` : '- Generate appropriate traits for this niche'}

The personality should feel natural for ${niche} content creators targeting the ${targetMarket} market.`;

  console.log(`[character-profile-gen] Calling Claude Sonnet for personality generation (niche=${niche}, market=${targetMarket})`);

  const response = await retryWithBackoff(
    async () => {
      const res = await llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
      return typeof res.content === 'string'
        ? res.content
        : (res.content as Array<{ type: string; text?: string }>)
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('');
    },
    { maxAttempts: 3, baseDelayMs: 1000 },
  );

  // Extract JSON from the response (may be wrapped in markdown code blocks)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  // Validate required fields
  const parsedTraits = parsed['traits'];
  const parsedSpeakingStyle = parsed['speaking_style'];
  const parsedLanguagePref = parsed['language_preference'];
  const parsedEmojiUsage = parsed['emoji_usage'];

  if (!Array.isArray(parsedTraits) || typeof parsedSpeakingStyle !== 'string') {
    return null;
  }

  const result: CharacterPersonality = {
    traits: parsedTraits.filter((t): t is string => typeof t === 'string'),
    speaking_style: parsedSpeakingStyle,
    language_preference: typeof parsedLanguagePref === 'string' ? parsedLanguagePref : undefined,
    emoji_usage: typeof parsedEmojiUsage === 'string' ? parsedEmojiUsage : undefined,
  };

  if (typeof parsed['catchphrase'] === 'string') {
    result.catchphrase = parsed['catchphrase'];
  }

  console.log(`[character-profile-gen] LLM personality generated successfully (${result.traits?.length ?? 0} traits)`);
  return result;
}

/**
 * Template-based fallback for personality generation when LLM is unavailable.
 */
function buildPersonalityTemplate(
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
  const personality = await buildPersonalityFromNiche(
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
