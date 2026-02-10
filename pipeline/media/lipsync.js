'use strict';

const { submitAndWait } = require('./fal-client');

const ENDPOINT = 'fal-ai/sync-lipsync/v2/pro';

/**
 * Sync lips in a video to match audio using Sync Lipsync v2/pro via fal.ai.
 * @param {object} params
 * @param {string} params.videoUrl - Source video URL
 * @param {string} params.audioUrl - Audio track URL
 * @param {string} [params.syncMode='bounce'] - Sync mode
 * @returns {Promise<string>} Synced video URL
 */
async function syncLips({ videoUrl, audioUrl, syncMode = 'bounce' }) {
  const result = await submitAndWait(ENDPOINT, {
    video_url: videoUrl,
    audio_url: audioUrl,
    sync_mode: syncMode,
  });
  return result.video.url;
}

module.exports = { syncLips };
