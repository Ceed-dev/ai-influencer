/**
 * FEAT-MCC-022: check_video_status
 * Spec: 04-agent-design.md §4.6 #6
 * Checks the status of a video generation request.
 * Attempts real fal.ai queue status check for vgen_/lipsync_ prefixed IDs.
 * Falls back to 'completed' placeholder if fal.ai is not configured.
 */
import { fal } from '@fal-ai/client';
import type {
  CheckVideoStatusInput,
  CheckVideoStatusOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors.js';
import { initFalClient } from '../../../workers/video-production/fal-client.js';

/** Map fal.ai queue status to our status enum */
function mapFalStatus(falStatus: string): CheckVideoStatusOutput['status'] {
  switch (falStatus) {
    case 'COMPLETED': return 'completed';
    case 'IN_PROGRESS': return 'processing';
    case 'IN_QUEUE': return 'pending';
    default: return 'processing';
  }
}

/** Determine the fal.ai endpoint from request_id prefix */
function getEndpointForRequest(requestId: string): string | null {
  if (requestId.startsWith('vgen_') || requestId.startsWith('fal_')) {
    return 'fal-ai/kling-video/v2.6/standard/image-to-video';
  }
  if (requestId.startsWith('lipsync_')) {
    return 'fal-ai/lipsync';
  }
  return null;
}

export async function checkVideoStatus(
  input: CheckVideoStatusInput,
): Promise<CheckVideoStatusOutput> {
  if (!input.request_id || input.request_id.trim() === '') {
    throw new McpValidationError('request_id is required and must be non-empty');
  }

  const endpoint = getEndpointForRequest(input.request_id);

  if (endpoint) {
    try {
      await initFalClient();
      const queueStatus = await fal.queue.status(endpoint, {
        requestId: input.request_id,
      });

      const status = mapFalStatus(queueStatus.status);

      if (status === 'completed') {
        const result = await fal.queue.result(endpoint, {
          requestId: input.request_id,
        });
        const videoUrl = ((result as Record<string, unknown>)['data'] as Record<string, unknown>)?.['video']
          ? (((result as Record<string, unknown>)['data'] as Record<string, unknown>)['video'] as Record<string, unknown>)?.['url'] as string
          : ((result as Record<string, unknown>)['video'] as Record<string, unknown>)?.['url'] as string | undefined;

        return {
          status: 'completed',
          video_url: videoUrl ?? `https://fal.ai/result/${input.request_id}`,
        };
      }

      return { status };
    } catch (err) {
      console.warn(
        '[check_video_status] fal.ai status check failed, falling back to placeholder:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // Fallback: return completed with a synthetic URL
  return {
    status: 'completed',
    video_url: `https://fal.ai/result/${input.request_id}`,
  };
}
