/**
 * FEAT-MCC-015: start_video_generation
 * Spec: 04-agent-design.md SS4.6 #5
 * Placeholder for Kling video generation.
 * Generates a request_id; actual fal.ai integration is in video-worker.
 */
import type {
  StartVideoGenerationInput,
  StartVideoGenerationOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors';

export async function startVideoGeneration(
  input: StartVideoGenerationInput,
): Promise<StartVideoGenerationOutput> {
  if (!input.image_url || input.image_url.trim() === '') {
    throw new McpValidationError('image_url must not be empty');
  }

  const requestId = `vgen_${Date.now()}_${input.section}`;

  return {
    request_id: requestId,
  };
}
