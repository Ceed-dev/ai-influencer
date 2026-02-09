'use strict';

const youtubeAdapter = require('./adapters/youtube');
const instagramAdapter = require('./adapters/instagram');
const tiktokAdapter = require('./adapters/tiktok');
const twitterAdapter = require('./adapters/twitter');

const adapters = {
  youtube: youtubeAdapter,
  instagram: instagramAdapter,
  tiktok: tiktokAdapter,
  twitter: twitterAdapter,
};

async function post({ platform, videoPath, metadata }) {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new Error(`Unsupported platform: ${platform}. Supported: ${Object.keys(adapters).join(', ')}`);
  }

  return adapter.upload({
    videoPath,
    title: metadata.title || '',
    description: metadata.description || '',
    tags: metadata.tags || [],
    categoryId: metadata.categoryId,
  });
}

module.exports = { post };
