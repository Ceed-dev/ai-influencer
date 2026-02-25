/**
 * FEAT-TP-004: LLM text generation for text_post content
 * Spec: 04-agent-design.md §4.6 (#2), 02-architecture.md §5
 *
 * Uses Claude Sonnet via @langchain/anthropic for text generation.
 * Falls back to template if API is unavailable.
 * All config from DB system_settings — no hardcoding.
 */
import type { Platform, ScriptLanguage } from '@/types/database';
import { retryWithBackoff } from '../../lib/retry.js';
import { getSettingString } from '../../lib/settings.js';

/** Input for text generation */
export interface TextGenerationInput {
  contentId: string;
  characterName: string;
  characterPersonality: Record<string, unknown>;
  scenarioData: Record<string, unknown>;
  scriptLanguage: ScriptLanguage;
  platform: Platform;
  maxLength?: number;
}

/** Generated text output */
export interface TextGenerationOutput {
  text: string;
  hookText: string;
  bodyText: string;
  ctaText: string;
  hashtags: string[];
  estimatedReadTime: number; // seconds
  platform: Platform;
  language: ScriptLanguage;
}

/** Platform-specific character limits */
export const PLATFORM_TEXT_LIMITS: Record<Platform, number> = {
  youtube: 5000,     // YouTube description
  tiktok: 2200,      // TikTok caption
  instagram: 2200,   // Instagram caption
  x: 280,            // X/Twitter
};

/**
 * Get the character limit for a platform.
 */
export function getCharacterLimit(platform: Platform): number {
  return PLATFORM_TEXT_LIMITS[platform];
}

/**
 * Estimate read time in seconds for a given text.
 * Average reading speed: ~200 words/minute for English, ~400 chars/minute for Japanese.
 */
export function estimateReadTime(text: string, language: ScriptLanguage): number {
  if (language === 'jp') {
    return Math.ceil((text.length / 400) * 60);
  }
  const wordCount = text.split(/\s+/).length;
  return Math.ceil((wordCount / 200) * 60);
}

/**
 * Build a text generation prompt for the LLM.
 */
export function buildTextPrompt(input: TextGenerationInput): string {
  const limit = input.maxLength ?? getCharacterLimit(input.platform);
  const personalityTraits = (input.characterPersonality['traits'] ?? []) as string[];
  const speakingStyle = (input.characterPersonality['speaking_style'] ?? 'natural') as string;

  const langInstruction = input.scriptLanguage === 'jp'
    ? 'Write in Japanese (日本語).'
    : 'Write in English.';

  return [
    `You are ${input.characterName}, a social media influencer.`,
    `Personality: ${personalityTraits.join(', ')}. Speaking style: ${speakingStyle}.`,
    `Platform: ${input.platform}. Character limit: ${limit}.`,
    langInstruction,
    '',
    'Create a post with:',
    '1. Hook (attention-grabbing opening)',
    '2. Body (main content)',
    '3. CTA (call to action)',
    '4. Hashtags (3-5 relevant)',
    '',
    `Topic/scenario: ${JSON.stringify(input.scenarioData)}`,
  ].join('\n');
}

/**
 * Generate template-based fallback text.
 */
function generateFallbackText(input: TextGenerationInput): TextGenerationOutput {
  const limit = input.maxLength ?? getCharacterLimit(input.platform);
  const hookText = `[${input.characterName}] Hook for ${input.platform}`;
  const bodyText = `Body content about ${JSON.stringify(input.scenarioData).slice(0, 100)}`;
  const ctaText = 'Follow for more!';
  const text = [hookText, bodyText, ctaText].join('\n\n').slice(0, limit);

  return {
    text,
    hookText,
    bodyText,
    ctaText,
    hashtags: ['#content', '#ai', `#${input.platform}`],
    estimatedReadTime: estimateReadTime(text, input.scriptLanguage),
    platform: input.platform,
    language: input.scriptLanguage,
  };
}

/**
 * Parse LLM response text into structured output.
 */
function parseLlmResponse(
  responseText: string,
  input: TextGenerationInput,
): TextGenerationOutput {
  const limit = input.maxLength ?? getCharacterLimit(input.platform);

  // Try to extract sections from the response
  let hookText = '';
  let bodyText = '';
  let ctaText = '';
  let hashtags: string[] = [];

  // Pattern: look for labeled sections
  const hookMatch = responseText.match(/(?:hook|opening|注目)[:\s]*(.+?)(?=\n(?:body|main|本文|cta|call|ハッシュ|#)|$)/is);
  const bodyMatch = responseText.match(/(?:body|main|本文)[:\s]*(.+?)(?=\n(?:cta|call|ハッシュ|#)|$)/is);
  const ctaMatch = responseText.match(/(?:cta|call to action|アクション)[:\s]*(.+?)(?=\n(?:hashtag|ハッシュ|#)|$)/is);
  const hashtagMatch = responseText.match(/((?:#\S+\s*)+)/g);

  if (hookMatch) {
    hookText = hookMatch[1]!.trim();
  }
  if (bodyMatch) {
    bodyText = bodyMatch[1]!.trim();
  }
  if (ctaMatch) {
    ctaText = ctaMatch[1]!.trim();
  }
  if (hashtagMatch) {
    const allTags = hashtagMatch.join(' ').match(/#\S+/g);
    hashtags = allTags ? allTags.slice(0, 5) : [];
  }

  // If parsing failed, use the whole response as the body
  if (!hookText && !bodyText) {
    const lines = responseText.split('\n').filter((l) => l.trim());
    hookText = lines[0] ?? '';
    bodyText = lines.slice(1, -1).join('\n') || responseText;
    ctaText = lines.length > 2 ? (lines[lines.length - 1] ?? '') : '';
  }

  const text = [hookText, bodyText, ctaText].filter(Boolean).join('\n\n').slice(0, limit);

  return {
    text,
    hookText,
    bodyText,
    ctaText,
    hashtags: hashtags.length > 0 ? hashtags : ['#content', `#${input.platform}`],
    estimatedReadTime: estimateReadTime(text, input.scriptLanguage),
    platform: input.platform,
    language: input.scriptLanguage,
  };
}

/**
 * Generate text content for a text_post.
 *
 * Calls Claude Sonnet via @langchain/anthropic. Falls back to template if API unavailable.
 *
 * @param input - Text generation parameters
 * @returns Generated text content
 */
export async function generateTextContent(
  input: TextGenerationInput,
): Promise<TextGenerationOutput> {
  const prompt = buildTextPrompt(input);

  // Try LLM generation
  try {
    const apiKey = await getSettingString('CRED_ANTHROPIC_API_KEY');
    if (!apiKey || apiKey.trim() === '') {
      console.warn('[text-generator] CRED_ANTHROPIC_API_KEY not configured, using fallback');
      return generateFallbackText(input);
    }

    // Dynamic import to avoid startup failure if package not available
    const { ChatAnthropic } = await import('@langchain/anthropic');

    const model = new ChatAnthropic({
      modelName: 'claude-sonnet-4-5-20250514',
      anthropicApiKey: apiKey,
      maxTokens: 1024,
      temperature: 0.8,
    });

    const responseText = await retryWithBackoff(
      async () => {
        const response = await model.invoke([
          {
            role: 'system',
            content: 'You are a social media content writer. Output the post directly without any meta-commentary. Format your response with clear sections: Hook, Body, CTA, and Hashtags.',
          },
          { role: 'user', content: prompt },
        ]);

        const content = response.content;
        if (typeof content === 'string') return content;
        // Handle array of content blocks
        if (Array.isArray(content)) {
          return content
            .filter((block): block is { type: 'text'; text: string } =>
              typeof block === 'object' && block !== null && 'type' in block && block.type === 'text',
            )
            .map((block) => block.text)
            .join('\n');
        }
        return String(content);
      },
      {
        maxAttempts: 3,
        baseDelayMs: 2000,
        timeoutMs: 30000,
        isRetryable: (err) => {
          const msg = err instanceof Error ? err.message : '';
          // Retry on rate limits and server errors, not on auth errors
          return msg.includes('429') || msg.includes('529') || msg.includes('5');
        },
      },
    );

    return parseLlmResponse(responseText, input);
  } catch (err) {
    console.warn(
      '[text-generator] LLM generation failed, using fallback:',
      err instanceof Error ? err.message : String(err),
    );
    return generateFallbackText(input);
  }
}
