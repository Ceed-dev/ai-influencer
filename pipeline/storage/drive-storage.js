'use strict';

const https = require('https');
const http = require('http');
const { uploadToDrive } = require('../sheets/client');

/**
 * Download a file from a URL into a Buffer.
 */
function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadToBuffer(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Download a video from URL and upload it to Google Drive.
 * @param {object} params
 * @param {string} params.videoUrl - URL to download from
 * @param {string} params.fileName - Target file name in Drive
 * @param {string} params.folderId - Drive folder ID to upload into
 * @returns {Promise<{fileId: string, webViewLink: string}>}
 */
async function storeVideo({ videoUrl, fileName, folderId }) {
  const buffer = await downloadToBuffer(videoUrl);
  const result = await uploadToDrive(folderId, fileName, 'video/mp4', buffer);
  return {
    fileId: result.id,
    webViewLink: result.webViewLink,
  };
}

module.exports = { storeVideo };
