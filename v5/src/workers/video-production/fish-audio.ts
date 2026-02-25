/**
 * Fish Audio TTS client — Direct REST API
 * Spec: 04-agent-design.md §5.2
 */
import { retryWithBackoff, type RetryOptions } from '../../lib/retry.js';
import { getSettingString, getSettingNumber } from '../../lib/settings.js';

export interface TtsResult { audioUrl: string; audioBuffer: Buffer; processingTimeMs: number; }

export async function generateTts(text: string, voiceId: string, retryOptions?: RetryOptions): Promise<TtsResult> {
  const startTime = Date.now();
  const apiKey = await getSettingString('CRED_FISH_AUDIO_API_KEY');
  const timeoutMs = await getSettingNumber('TTS_TIMEOUT_SEC').then((s) => s * 1000).catch(() => 120000);
  const opts: RetryOptions = { maxAttempts: 3, baseDelayMs: 1000, backoffMultiplier: 2.0, maxDelayMs: 60000, jitterFraction: 0.2, timeoutMs, ...retryOptions };

  const audioBuffer = await retryWithBackoff(async (signal) => {
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, reference_id: voiceId, format: 'mp3' }),
      signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const err = new Error(`Fish Audio TTS failed: ${response.status} ${response.statusText} - ${body}`) as Error & { status: number };
      err.status = response.status;
      throw err;
    }
    return Buffer.from(await response.arrayBuffer());
  }, opts);

  return { audioUrl: '', audioBuffer, processingTimeMs: Date.now() - startTime };
}
