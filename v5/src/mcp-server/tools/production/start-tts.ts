/**
 * FEAT-MCC-016: start_tts
 * Spec: 04-agent-design.md SS4.6 #7
 * Placeholder for Fish Audio TTS.
 * Validates input; actual Fish Audio integration is in video-worker.
 */
import type {
  StartTtsInput,
  StartTtsOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors';

const VALID_LANGUAGES = ['en', 'jp'] as const;

export async function startTts(
  input: StartTtsInput,
): Promise<StartTtsOutput> {
  if (!input.voice_id || input.voice_id.trim() === '') {
    throw new McpValidationError('voice_id must not be empty');
  }

  if (!VALID_LANGUAGES.includes(input.language as typeof VALID_LANGUAGES[number])) {
    throw new McpValidationError(
      `Invalid language: "${input.language}". Must be one of: ${VALID_LANGUAGES.join(', ')}`,
    );
  }

  return {
    audio_url: `tts_placeholder_${Date.now()}`,
  };
}
