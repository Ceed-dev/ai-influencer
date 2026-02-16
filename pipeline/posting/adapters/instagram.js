'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const config = require('../../config');
const { getDrive } = require('../../sheets/client');
const { getValidToken, getAccountCredentials } = require('../ig-credential-manager');
const { uploadToFalStorage } = require('../../media/fal-client');

/**
 * GET JSON from a URL.
 */
function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let chunks = '';
      res.on('data', (chunk) => { chunks += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(chunks) });
        } catch (e) {
          reject(new Error(`Failed to parse Instagram response: ${chunks.slice(0, 500)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * POST form data to a URL.
 */
function postForm(url, params) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(params).toString();
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', (chunk) => { chunks += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(chunks) });
        } catch (e) {
          reject(new Error(`Failed to parse Instagram response: ${chunks.slice(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Download a video from Google Drive to a temporary file.
 */
async function downloadVideoToTemp(driveFileId) {
  const drive = getDrive();
  const tmpPath = path.join(os.tmpdir(), `ig-upload-${driveFileId}-${Date.now()}.mp4`);

  const res = await drive.files.get(
    { fileId: driveFileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );

  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(tmpPath);
    res.data
      .on('error', reject)
      .pipe(dest)
      .on('finish', resolve)
      .on('error', reject);
  });

  return {
    tmpPath,
    cleanup() {
      try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload a video as an Instagram Reel from a specific account.
 *
 * Flow:
 * 1. Download video from Drive to tmp
 * 2. Upload to fal.storage for a public URL
 * 3. Create media container (POST /{igUserId}/media)
 * 4. Poll container status until FINISHED
 * 5. Publish (POST /{igUserId}/media_publish)
 *
 * @param {string} accountId - Account ID (e.g. ACC_0002)
 * @param {object} opts
 * @param {string} opts.driveFileId - Google Drive file ID of the final.mp4
 * @param {string} opts.caption - Reel caption text
 * @returns {{ mediaId: string, permalink: string }}
 */
async function uploadReel(accountId, { driveFileId, caption }) {
  if (!driveFileId) throw new Error('driveFileId is required');

  const accessToken = await getValidToken(accountId);
  const account = getAccountCredentials(accountId);
  if (!account || !account.igUserId) {
    throw new Error(`No IG User ID for account ${accountId}. Run: npm run ig:setup ${accountId}`);
  }

  const igUserId = account.igUserId;
  const apiBase = `https://graph.instagram.com/${config.instagram.graphApiVersion}`;
  const { tmpPath, cleanup } = await downloadVideoToTemp(driveFileId);

  try {
    // Upload to fal.storage for a public URL
    const videoBuffer = fs.readFileSync(tmpPath);
    const publicVideoUrl = await uploadToFalStorage(videoBuffer, 'video/mp4');

    // Step 1: Create media container
    const containerRes = await postForm(`${apiBase}/${igUserId}/media`, {
      media_type: 'REELS',
      video_url: publicVideoUrl,
      caption: caption || '',
      share_to_feed: 'true',
      access_token: accessToken,
    });

    if (containerRes.data.error) {
      throw new Error(`Instagram container creation failed: ${containerRes.data.error.message}`);
    }

    const containerId = containerRes.data.id;

    // Step 2: Poll container status (max 120 seconds, 10-second intervals)
    for (let i = 0; i < 12; i++) {
      await sleep(10000);

      const statusRes = await getJson(
        `${apiBase}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
      );

      if (statusRes.data.error) {
        throw new Error(`Instagram status check failed: ${statusRes.data.error.message}`);
      }

      const statusCode = statusRes.data.status_code;
      if (statusCode === 'FINISHED') break;
      if (statusCode === 'ERROR') {
        throw new Error('Instagram media container processing failed');
      }
    }

    // Step 3: Publish
    const publishRes = await postForm(`${apiBase}/${igUserId}/media_publish`, {
      creation_id: containerId,
      access_token: accessToken,
    });

    if (publishRes.data.error) {
      throw new Error(`Instagram publish failed: ${publishRes.data.error.message}`);
    }

    const mediaId = publishRes.data.id;

    // Get permalink
    let permalink = '';
    try {
      const mediaRes = await getJson(
        `${apiBase}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`
      );
      permalink = (mediaRes.data && mediaRes.data.permalink) || '';
    } catch (_) { /* permalink is optional */ }

    return { mediaId, permalink };
  } finally {
    cleanup();
  }
}

module.exports = { uploadReel, downloadVideoToTemp };
