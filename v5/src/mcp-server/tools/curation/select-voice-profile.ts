/**
 * MCI-022b: select_voice_profile
 * Spec: 04-agent-design.md S4.10 #9
 *
 * Primary: Fish Audio API voice catalog search.
 * Fallback: deterministic voice ID generation when API key is unavailable.
 */
import type {
  SelectVoiceProfileInput,
  SelectVoiceProfileOutput,
} from '@/types/mcp-tools';
import { getPool } from '../../db';
import { McpValidationError, McpNotFoundError } from '../../errors';
import { getSetting } from '../../../lib/settings.js';
import { retryWithBackoff } from '../../../lib/retry.js';

/** Fish Audio model list response */
interface FishAudioModel {
  _id: string;
  title: string;
  description?: string;
  languages?: string[];
  tags?: string[];
  samples?: Array<{ url: string }>;
}

interface FishAudioListResponse {
  items: FishAudioModel[];
  total?: number;
}

/**
 * Search Fish Audio voice catalog and select best match.
 * Returns null if API key is unavailable or API call fails.
 */
async function searchFishAudioVoices(
  language: string,
  gender?: string,
  ageRange?: string,
  personality?: Record<string, unknown>,
): Promise<{ voice_id: string; voice_name: string; sample_url: string } | null> {
  let apiKey: string;
  try {
    apiKey = String(await getSetting('CRED_FISH_AUDIO_API_KEY'));
  } catch {
    return null;
  }
  if (!apiKey) return null;

  console.log(`[select-voice-profile] Searching Fish Audio catalog (language=${language}, gender=${gender ?? 'any'})`);

  try {
    // Build search query from language + gender
    const searchTerms = [language];
    if (gender) searchTerms.push(gender);

    const searchUrl = new URL('https://api.fish.audio/model');
    searchUrl.searchParams.set('title', searchTerms.join(' '));
    searchUrl.searchParams.set('page_size', '20');
    searchUrl.searchParams.set('page_number', '1');

    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(searchUrl.toString(), {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          throw new Error(`Fish Audio API error: ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<FishAudioListResponse>;
      },
      { maxAttempts: 3, baseDelayMs: 1000 },
    );

    const models = response.items ?? [];
    if (models.length === 0) {
      console.warn('[select-voice-profile] No voices found in Fish Audio catalog');
      return null;
    }

    // Score each voice against requirements
    const scored = models.map((model) => {
      let score = 0;

      // Language match
      if (model.languages?.some((l) => l.toLowerCase().includes(language.toLowerCase()))) {
        score += 10;
      }

      // Gender match from tags/description
      if (gender && model.tags) {
        if (model.tags.some((t) => t.toLowerCase().includes(gender.toLowerCase()))) {
          score += 5;
        }
      }
      if (gender && model.description?.toLowerCase().includes(gender.toLowerCase())) {
        score += 3;
      }

      // Age range match from tags/description
      if (ageRange && model.tags) {
        if (model.tags.some((t) => t.toLowerCase().includes(ageRange.toLowerCase()))) {
          score += 3;
        }
      }

      // Personality tone match (if personality has tone/style info)
      if (personality) {
        const tone = String(personality['tone'] ?? personality['speaking_style'] ?? '').toLowerCase();
        if (tone && model.description?.toLowerCase().includes(tone)) {
          score += 2;
        }
      }

      return { model, score };
    });

    // Select best match
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0]?.model;
    if (!best) return null;

    const sampleUrl = best.samples?.[0]?.url ?? `https://api.fish.audio/model/${best._id}/sample`;

    console.log(`[select-voice-profile] Selected Fish Audio voice: "${best.title}" (id=${best._id})`);

    return {
      voice_id: best._id,
      voice_name: best.title,
      sample_url: sampleUrl,
    };
  } catch (err) {
    console.warn(
      `[select-voice-profile] Fish Audio API failed, using fallback: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Deterministic fallback when Fish Audio API is unavailable.
 */
function generateDeterministicVoice(
  language: string,
  gender?: string,
  ageRange?: string,
): { voice_id: string; voice_name: string; sample_url: string } {
  const voiceIdBase = `${language}_${gender ?? 'neutral'}_${ageRange ?? 'adult'}`;
  const voiceId = Buffer.from(voiceIdBase.padEnd(16, '0').slice(0, 16))
    .toString('hex');
  const voiceName = `${language}_voice_${gender ?? 'neutral'}`;
  const sampleUrl = `https://placeholder.fish.audio/samples/${voiceId}.mp3`;

  return { voice_id: voiceId, voice_name: voiceName, sample_url: sampleUrl };
}

export async function selectVoiceProfile(
  input: SelectVoiceProfileInput,
): Promise<SelectVoiceProfileOutput> {
  if (!input.character_id || input.character_id.trim().length === 0) {
    throw new McpValidationError('character_id is required');
  }
  if (!input.language || input.language.trim().length === 0) {
    throw new McpValidationError('language is required');
  }

  const pool = getPool();

  // Verify character exists
  const charRes = await pool.query(
    `SELECT id FROM characters WHERE character_id = $1`,
    [input.character_id],
  );
  if (charRes.rowCount === 0) {
    throw new McpNotFoundError(`Character "${input.character_id}" not found`);
  }

  // Try Fish Audio API first, fall back to deterministic generation
  const result = await searchFishAudioVoices(
    input.language,
    input.gender,
    input.age_range,
    input.personality,
  ) ?? generateDeterministicVoice(input.language, input.gender, input.age_range);

  // Update the character's voice_id
  await pool.query(
    `UPDATE characters SET voice_id = $1 WHERE character_id = $2`,
    [result.voice_id, input.character_id],
  );

  return {
    voice_id: result.voice_id,
    voice_name: result.voice_name,
    sample_url: result.sample_url,
  };
}
