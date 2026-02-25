/**
 * FEAT-VW-003/009/013: fal.ai Kling client
 * Spec: 04-agent-design.md §5.2
 */
import { fal } from '@fal-ai/client';
import { retryWithBackoff, type RetryOptions } from '../../lib/retry.js';
import { getSettingString, getSettingNumber } from '../../lib/settings.js';

export interface FalApiError extends Error { status?: number; body?: Record<string, unknown>; }
export interface KlingResult { requestId: string; videoUrl: string; processingTimeMs: number; }

export function isFalRetryable(error: unknown): boolean {
  const err = error as FalApiError;
  if (err.status === 403 || err.status === 422) return false;
  return true;
}

export function classifyFalError(error: unknown): { message: string; permanent: boolean } {
  const err = error as FalApiError;
  if (err.status === 403) return { message: `fal.ai 403 Forbidden: balance exhausted or unauthorized. ${err.message || ''}`, permanent: true };
  if (err.status === 422) return { message: `fal.ai 422 Unprocessable Entity: invalid parameters. ${err.message || ''}`, permanent: true };
  return { message: `fal.ai error: ${err.message || String(error)}`, permanent: false };
}

export async function initFalClient(): Promise<void> {
  const apiKey = await getSettingString('CRED_FAL_AI_API_KEY');
  fal.config({ credentials: apiKey });
}

export function resizeImageIfNeeded(width: number, height: number, maxDim: number = 3850): { width: number; height: number; resized: boolean } {
  if (width <= maxDim && height <= maxDim) return { width, height, resized: false };
  const scale = maxDim / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale), resized: true };
}

export async function generateVideo(imageUrl: string, prompt: string, options: { duration?: number; retryOptions?: RetryOptions } = {}): Promise<KlingResult> {
  const startTime = Date.now();
  const timeoutMs = await getSettingNumber('VIDEO_SECTION_TIMEOUT_SEC').then((s) => s * 1000).catch(() => 600000);
  const retryOpts: RetryOptions = { maxAttempts: 3, baseDelayMs: 2000, backoffMultiplier: 2.0, maxDelayMs: 300000, jitterFraction: 0.2, timeoutMs, isRetryable: isFalRetryable, ...options.retryOptions };
  const result = await retryWithBackoff(async (signal) => {
    const response = await fal.subscribe('fal-ai/kling-video/v2.6/standard/image-to-video', {
      input: { prompt, image_url: imageUrl, duration: options.duration ?? 5 },
      onQueueUpdate: () => { if (signal.aborted) throw new Error('Operation aborted'); },
    });
    return response;
  }, retryOpts);

  return {
    requestId: (result as Record<string, unknown>)['request_id'] as string ?? `fal_${Date.now()}`,
    videoUrl: ((result as Record<string, unknown>)['video'] as Record<string, unknown>)?.['url'] as string ?? '',
    processingTimeMs: Date.now() - startTime,
  };
}
