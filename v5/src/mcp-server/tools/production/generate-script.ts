/**
 * FEAT-MCC-023: generate_script
 * Spec: 04-agent-design.md §4.6 #2
 * Generates hook, body, and CTA scripts based on scenario data.
 *
 * Primary: Anthropic Claude API for LLM-driven script generation.
 * Fallback: template-based generation when API key is unavailable.
 */
import type {
  GenerateScriptInput,
  GenerateScriptOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors';
import { getSetting } from '../../../lib/settings.js';

const VALID_LANGUAGES = ['en', 'jp'] as const;

/** Cached API key state (loaded once from system_settings) */
let cachedApiKey: string | null | undefined;

async function loadApiKey(): Promise<string | null> {
  if (cachedApiKey === undefined) {
    try {
      cachedApiKey = String(await getSetting('CRED_ANTHROPIC_API_KEY'));
    } catch {
      cachedApiKey = null;
    }
  }
  return cachedApiKey;
}

/**
 * Generate scripts via Anthropic Claude API.
 * Returns null if the API call fails (caller falls back to template).
 */
async function generateViaLlm(
  input: GenerateScriptInput,
  topic: string,
  emotion: string,
): Promise<GenerateScriptOutput | null> {
  const apiKey = await loadApiKey();
  if (!apiKey) return null;

  const langLabel = input.script_language === 'jp' ? 'Japanese' : 'English';
  const scenarioJson = JSON.stringify(input.scenario_data);

  const prompt = `You are a social media content script writer. Generate a short-form video script in ${langLabel}.

Scenario data: ${scenarioJson}
Topic: ${topic}
Emotion/Tone: ${emotion}

Return ONLY valid JSON with exactly these 3 fields:
{
  "hook_script": "A 1-2 sentence hook that grabs attention, mentioning the topic '${topic}'",
  "body_script": "A 2-4 sentence body that delivers value",
  "cta_script": "A 1 sentence call-to-action"
}

Requirements:
- The hook MUST contain the word "${topic}"
- Keep each section concise and engaging
- Match the ${emotion} tone throughout
${input.script_language === 'jp' ? '- Write in natural Japanese. CTA should include チャンネル登録.' : ''}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.warn(`[generate-script] Anthropic API error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');

    // Extract JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    if (
      typeof parsed['hook_script'] === 'string' &&
      typeof parsed['body_script'] === 'string' &&
      typeof parsed['cta_script'] === 'string'
    ) {
      return {
        hook_script: parsed['hook_script'] as string,
        body_script: parsed['body_script'] as string,
        cta_script: parsed['cta_script'] as string,
      };
    }
    return null;
  } catch (err) {
    console.warn(
      `[generate-script] LLM generation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Template-based fallback when LLM is unavailable.
 */
function generateTemplate(
  topic: string,
  emotion: string,
  language: 'en' | 'jp',
): GenerateScriptOutput {
  if (language === 'jp') {
    return {
      hook_script: `【${topic}】注目！この${emotion}な瞬間を見てください`,
      body_script: `${topic}について詳しく解説します。${emotion}な雰囲気でお届けします。`,
      cta_script: 'チャンネル登録と高評価をお願いします！',
    };
  }

  return {
    hook_script: `Check this out! The most ${emotion} moment about ${topic}`,
    body_script: `Let me tell you everything about ${topic}. You won't believe how ${emotion} this gets.`,
    cta_script: 'Like, subscribe, and share with your friends!',
  };
}

/** Reset cached API key (for testing) */
export function resetScriptCache(): void {
  cachedApiKey = undefined;
}

export async function generateScript(
  input: GenerateScriptInput,
): Promise<GenerateScriptOutput> {
  if (!input.content_id || input.content_id.trim() === '') {
    throw new McpValidationError('content_id is required and must be non-empty');
  }

  if (!VALID_LANGUAGES.includes(input.script_language)) {
    throw new McpValidationError(
      `Invalid script_language: "${input.script_language}". Must be one of: ${VALID_LANGUAGES.join(', ')}`,
    );
  }

  const topic = (input.scenario_data['topic'] as string | undefined) ?? 'general';
  const emotion = (input.scenario_data['emotion'] as string | undefined) ?? 'neutral';

  // Try LLM generation first, fall back to template
  const llmResult = await generateViaLlm(input, topic, emotion);
  if (llmResult) return llmResult;

  return generateTemplate(topic, emotion, input.script_language);
}
