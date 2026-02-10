'use strict';

const { submitAndWait } = require('./fal-client');

const ENDPOINT = 'fal-ai/elevenlabs/tts/eleven-v3';

/**
 * Generate speech audio from text using ElevenLabs eleven-v3 via fal.ai.
 * @param {object} params
 * @param {string} params.text - Text to speak
 * @param {string} [params.voice='Aria'] - Voice name
 * @returns {Promise<string>} Audio URL
 */
async function generateSpeech({ text, voice = 'Aria' }) {
  const result = await submitAndWait(ENDPOINT, {
    text,
    voice,
  });
  return result.audio.url;
}

module.exports = { generateSpeech };
