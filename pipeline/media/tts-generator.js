'use strict';

const config = require('../config');
const { uploadToFalStorage } = require('./fal-client');

const RETRY_DELAYS = [2000, 5000, 10000]; // ms

/**
 * Generate speech audio from text using Fish Audio TTS API.
 * Returns a fal.storage URL (compatible with lipsync pipeline).
 * @param {object} params
 * @param {string} params.text - Text to speak
 * @param {string} params.referenceId - Fish Audio voice reference_id (required)
 * @returns {Promise<string>} Audio URL (fal.storage)
 */
async function generateSpeech({ text, referenceId }) {
  if (!config.fishAudio.apiKey) {
    throw new Error('FISH_AUDIO_API_KEY is not set. Add it to your .env file.');
  }
  if (!referenceId) {
    throw new Error('referenceId (Fish Audio voice reference_id) is required.');
  }
  const body = { text, format: config.fishAudio.defaultFormat, reference_id: referenceId };

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${config.fishAudio.baseUrl}/tts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.fishAudio.apiKey}`,
          'Content-Type': 'application/json',
          'model': config.fishAudio.model,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const err = new Error(`Fish Audio TTS failed (${res.status}): ${errText}`);
        err.status = res.status;
        throw err;
      }

      const audioBuffer = Buffer.from(await res.arrayBuffer());
      const audioUrl = await uploadToFalStorage(audioBuffer, 'audio/mpeg');
      return audioUrl;
    } catch (err) {
      lastError = err;
      const status = err.status || 0;
      const isTransient = status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
      if (!isTransient || attempt >= 2) throw err;

      const delay = RETRY_DELAYS[attempt] || 10000;
      console.warn(`[tts] Fish Audio transient error (attempt ${attempt + 1}/3), retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

module.exports = { generateSpeech };
