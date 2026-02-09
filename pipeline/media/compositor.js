'use strict';

const { submitAndWait } = require('./fal-client');

const ENDPOINT = 'fal-ai/creatify/aurora';

/**
 * Composite video + audio into a final video using Creatify Aurora via fal.ai.
 * @param {object} params
 * @param {string} params.videoUrl - Video URL
 * @param {string} params.audioUrl - Audio URL
 * @param {object} [params.options] - Additional Creatify options
 * @returns {Promise<string>} Final video URL
 */
async function composite({ videoUrl, audioUrl, options = {} }) {
  const result = await submitAndWait(ENDPOINT, {
    video_url: videoUrl,
    audio_url: audioUrl,
    ...options,
  });
  return result.video.url;
}

module.exports = { composite };
