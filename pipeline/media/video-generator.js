'use strict';

const { submitAndWait } = require('./fal-client');

const ENDPOINT = 'fal-ai/kling-video/v2.6/standard/motion-control';

/**
 * Generate a video from an image using Kling v2.6 motion-control via fal.ai.
 * @param {object} params
 * @param {string} params.imageUrl - Source image URL (fal.storage or public URL)
 * @param {string} params.motionVideoUrl - Motion reference video URL
 * @param {number} [params.duration=5] - Video duration in seconds
 * @param {string} [params.aspectRatio='9:16'] - Aspect ratio
 * @returns {Promise<string>} Video URL
 */
async function generateVideo({ imageUrl, motionVideoUrl, duration = 5, aspectRatio = '9:16' }) {
  const result = await submitAndWait(ENDPOINT, {
    image_url: imageUrl,
    video_url: motionVideoUrl,
    duration,
    aspect_ratio: aspectRatio,
    character_orientation: 'video',
  });
  return result.video.url;
}

module.exports = { generateVideo };
