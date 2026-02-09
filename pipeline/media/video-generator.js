'use strict';

const { submitAndWait } = require('./fal-client');

const ENDPOINT = 'fal-ai/kling-video/v2.6/standard/image-to-video';

/**
 * Generate a video from an image using Kling v2.6 via fal.ai.
 * @param {object} params
 * @param {string} params.imageUrl - Source image URL (e.g. from Cloudinary)
 * @param {string} params.prompt - Motion/action prompt
 * @param {number} [params.duration=5] - Video duration in seconds
 * @param {string} [params.aspectRatio='9:16'] - Aspect ratio
 * @returns {Promise<string>} Video URL
 */
async function generateVideo({ imageUrl, prompt, duration = 5, aspectRatio = '9:16' }) {
  const result = await submitAndWait(ENDPOINT, {
    image_url: imageUrl,
    prompt,
    duration,
    aspect_ratio: aspectRatio,
  });
  return result.video.url;
}

module.exports = { generateVideo };
