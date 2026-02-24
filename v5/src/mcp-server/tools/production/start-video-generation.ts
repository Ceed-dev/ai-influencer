/**
 * FEAT-MCC-015: start_video_generation
 * Spec: 04-agent-design.md SS4.6 #5
 * Delegates to fal.ai Kling client for real video generation.
 * Falls back to placeholder if fal.ai is not configured.
 */
import type {
  StartVideoGenerationInput,
  StartVideoGenerationOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors.js';
import { initFalClient, generateVideo } from '../../../workers/video-production/fal-client.js';

export async function startVideoGeneration(
  input: StartVideoGenerationInput,
): Promise<StartVideoGenerationOutput> {
  if (!input.image_url || input.image_url.trim() === '') {
    throw new McpValidationError('image_url must not be empty');
  }

  const prompt = typeof input.motion_data?.['prompt'] === 'string'
    ? input.motion_data['prompt'] as string
    : `Generate video for section: ${input.section}`;

  try {
    await initFalClient();
    const result = await generateVideo(input.image_url, prompt);
    return {
      request_id: result.requestId,
    };
  } catch (err) {
    console.warn(
      '[start_video_generation] fal.ai call failed, falling back to placeholder:',
      err instanceof Error ? err.message : String(err),
    );
    const requestId = `vgen_${Date.now()}_${input.section}`;
    return {
      request_id: requestId,
    };
  }
}
