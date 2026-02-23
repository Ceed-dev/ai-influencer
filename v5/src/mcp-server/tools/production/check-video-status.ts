/**
 * FEAT-MCC-022: check_video_status
 * Spec: 04-agent-design.md §4.6 #6
 * Checks the status of a video generation request.
 * Placeholder: always returns completed with a synthetic URL.
 */
import type {
  CheckVideoStatusInput,
  CheckVideoStatusOutput,
} from '@/types/mcp-tools';
import { McpValidationError } from '../../errors';

export async function checkVideoStatus(
  input: CheckVideoStatusInput,
): Promise<CheckVideoStatusOutput> {
  if (!input.request_id || input.request_id.trim() === '') {
    throw new McpValidationError('request_id is required and must be non-empty');
  }

  // Placeholder: return completed with a synthetic URL
  return {
    status: 'completed',
    video_url: `https://fal.ai/result/${input.request_id}`,
  };
}
