'use strict';

const { submitAndWait } = require('./fal-client');

const ENDPOINT = 'fal-ai/sync-lipsync/v2';

/**
 * Sync lips in a video to match audio using Sync Lipsync v2 via fal.ai.
 * @param {object} params
 * @param {string} params.videoUrl - Source video URL
 * @param {string} params.audioUrl - Audio track URL
 * @returns {Promise<string>} Synced video URL
 */
async function syncLips({ videoUrl, audioUrl }) {
  const result = await submitAndWait(ENDPOINT, {
    video_url: videoUrl,
    audio_url: audioUrl,
  });
  return result.video.url;
}

module.exports = { syncLips };
