/**
 * FEAT-MCC-017: start_lipsync
 * Spec: 04-agent-design.md SS4.6 #8
 * Placeholder for fal.ai Lipsync.
 * Validates input URLs; actual integration is in video-worker.
 */
import type {
  StartLipsyncInput,
  StartLipsyncOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors';

export async function startLipsync(
  input: StartLipsyncInput,
): Promise<StartLipsyncOutput> {
  if (!input.video_url || input.video_url.trim() === '') {
    throw new McpValidationError('video_url must not be empty');
  }

  if (!input.audio_url || input.audio_url.trim() === '') {
    throw new McpValidationError('audio_url must not be empty');
  }

  return {
    request_id: `lipsync_${Date.now()}`,
  };
}
