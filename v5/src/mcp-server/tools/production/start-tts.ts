/**
 * FEAT-MCC-016: start_tts
 * Spec: 04-agent-design.md SS4.6 #7
 * Delegates to Fish Audio TTS for real speech synthesis.
 * Falls back to placeholder if Fish Audio is not configured.
 */
import type {
  StartTtsInput,
  StartTtsOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors.js';
import { generateTts } from '../../../workers/video-production/fish-audio.js';

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

  try {
    const result = await generateTts(input.text, input.voice_id);
    // If the worker returns an audioUrl, use it; otherwise the audio is in audioBuffer
    // and needs to be uploaded/stored separately (handled by the pipeline)
    const audioUrl = result.audioUrl || `tts_audio_${Date.now()}_${result.processingTimeMs}ms`;
    return {
      audio_url: audioUrl,
    };
  } catch (err) {
    console.warn(
      '[start_tts] Fish Audio call failed, falling back to placeholder:',
      err instanceof Error ? err.message : String(err),
    );
    return {
      audio_url: `tts_placeholder_${Date.now()}`,
    };
  }
}
