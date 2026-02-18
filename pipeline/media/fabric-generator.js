'use strict';

const { submitAndWait } = require('./fal-client');

const ENDPOINT = 'veed/fabric-1.0';

/**
 * Generate a lip-synced video from an image and audio using VEED Fabric 1.0 via fal.ai.
 * Fabric 1.0 directly produces a lip-synced video from a still image + audio,
 * eliminating the need for separate video generation + lip sync steps.
 *
 * Used for the Body section only. Hook and CTA continue using Kling + Lipsync.
 *
 * @param {object} params
 * @param {string} params.imageUrl - Character image URL (fal.storage or public URL)
 * @param {string} params.audioUrl - Audio track URL (fal.storage or public URL)
 * @param {string} [params.resolution='720p'] - Output resolution ('720p' or '480p')
 * @returns {Promise<string>} Video URL
 */
async function generateFabricVideo({ imageUrl, audioUrl, resolution = '720p' }) {
  const result = await submitAndWait(ENDPOINT, {
    image_url: imageUrl,
    audio_url: audioUrl,
    resolution,
  }, { timeout: 1800000 }); // 30 min — same generous timeout as Kling
  return result.video.url;
}

module.exports = { generateFabricVideo };
