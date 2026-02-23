/**
 * FEAT-MCC-023: generate_script
 * Spec: 04-agent-design.md §4.6 #2
 * Generates hook, body, and CTA scripts based on scenario data.
 * Placeholder: generates template scripts from scenario_data fields.
 */
import type {
  GenerateScriptInput,
  GenerateScriptOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors';

const VALID_LANGUAGES = ['en', 'jp'] as const;

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

  if (input.script_language === 'jp') {
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
