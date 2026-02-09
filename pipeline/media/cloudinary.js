'use strict';

const cloudinary = require('cloudinary').v2;
const config = require('../config');

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * Upload an image to Cloudinary and return its public URL.
 * @param {string} localPathOrUrl - Local file path or remote URL to upload
 * @param {object} options - Cloudinary upload options (folder, public_id, etc.)
 * @returns {Promise<{url: string, publicId: string}>}
 */
async function uploadImage(localPathOrUrl, options = {}) {
  const result = await cloudinary.uploader.upload(localPathOrUrl, {
    resource_type: 'image',
    ...options,
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

module.exports = { uploadImage };
