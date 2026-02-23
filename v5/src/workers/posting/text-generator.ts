/**
 * FEAT-TP-004: LLM text generation for text_post content
 * Spec: 04-agent-design.md §4.6 (#2), 02-architecture.md §5
 *
 * Placeholder for Claude Sonnet text generation.
 * Generates platform-specific text content based on scenario data.
 * All config from DB system_settings — no hardcoding.
 */
import type { Platform, ScriptLanguage } from '@/types/database';

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
 * This would be sent to Claude Sonnet in production.
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
 * Generate text content for a text_post.
 *
 * Placeholder implementation that returns template text.
 * In production, this calls Claude Sonnet via the Anthropic API.
 *
 * @param input - Text generation parameters
 * @returns Generated text content
 */
export async function generateTextContent(
  input: TextGenerationInput,
): Promise<TextGenerationOutput> {
  const _prompt = buildTextPrompt(input);
  const limit = input.maxLength ?? getCharacterLimit(input.platform);

  // Placeholder: in production, call Claude Sonnet API
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
