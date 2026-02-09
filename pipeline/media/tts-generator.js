'use strict';

const { submitAndWait } = require('./fal-client');
const config = require('../config');

const ENDPOINT = 'fal-ai/elevenlabs/tts/v3';

/**
 * Generate speech audio from text using ElevenLabs v3 via fal.ai.
 * @param {object} params
 * @param {string} params.text - Text to speak
 * @param {string} [params.voiceId] - ElevenLabs voice ID
 * @returns {Promise<string>} Audio URL
 */
async function generateSpeech({ text, voiceId }) {
  const result = await submitAndWait(ENDPOINT, {
    text,
    voice_id: voiceId || config.elevenlabs.defaultVoiceId,
  });
  return result.audio.url;
}

module.exports = { generateSpeech };
