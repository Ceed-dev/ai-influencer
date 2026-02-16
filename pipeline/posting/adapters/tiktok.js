'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const config = require('../../config');
const { getDrive } = require('../../sheets/client');
const { getValidToken } = require('../tiktok-credential-manager');

/**
 * POST JSON to a URL with Authorization header.
 */
function postJsonAuth(url, body, accessToken) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
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
          reject(new Error(`Failed to parse TikTok response: ${chunks.slice(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * PUT binary data to an upload URL.
 */
function putBinary(url, buffer, contentType) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'video/mp4',
        'Content-Range': `bytes 0-${buffer.length - 1}/${buffer.length}`,
        'Content-Length': buffer.length,
      },
    };

    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', (chunk) => { chunks += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: chunks });
      });
    });

    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

/**
 * Download a video from Google Drive to a temporary file.
 */
async function downloadVideoToTemp(driveFileId) {
  const drive = getDrive();
  const tmpPath = path.join(os.tmpdir(), `tiktok-upload-${driveFileId}-${Date.now()}.mp4`);

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
 * Upload a video to TikTok from a specific account.
 *
 * @param {string} accountId - Account ID (e.g. ACC_0001)
 * @param {object} opts
 * @param {string} opts.driveFileId - Google Drive file ID of the final.mp4
 * @param {string} opts.title - Video title/description
 * @param {string} [opts.privacyLevel] - SELF_ONLY (default) or PUBLIC_TO_EVERYONE
 * @returns {{ publishId: string, status: string }}
 */
async function uploadVideo(accountId, { driveFileId, title, privacyLevel }) {
  if (!driveFileId) throw new Error('driveFileId is required');
  if (!title) throw new Error('title is required');

  const accessToken = await getValidToken(accountId);
  const baseUrl = config.tiktok.baseUrl;
  const { tmpPath, cleanup } = await downloadVideoToTemp(driveFileId);

  try {
    const videoBuffer = fs.readFileSync(tmpPath);
    const videoSize = videoBuffer.length;

    // Step 1: Initialize upload
    const initRes = await postJsonAuth(`${baseUrl}/v2/post/publish/video/init/`, {
      post_info: {
        title: title.slice(0, 150),
        privacy_level: privacyLevel || 'SELF_ONLY',
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }, accessToken);

    if (initRes.data.error && initRes.data.error.code !== 'ok') {
      throw new Error(`TikTok init failed: ${initRes.data.error.message || JSON.stringify(initRes.data.error)}`);
    }

    const publishId = initRes.data.data.publish_id;
    const uploadUrl = initRes.data.data.upload_url;

    // Step 2: Upload video bytes
    const uploadRes = await putBinary(uploadUrl, videoBuffer, 'video/mp4');
    if (uploadRes.statusCode < 200 || uploadRes.statusCode >= 300) {
      throw new Error(`TikTok upload failed with status ${uploadRes.statusCode}: ${uploadRes.body.slice(0, 200)}`);
    }

    // Step 3: Poll for publish status (max 60 seconds, 5-second intervals)
    let status = 'PROCESSING';
    for (let i = 0; i < 12; i++) {
      await sleep(5000);

      const statusRes = await postJsonAuth(`${baseUrl}/v2/post/publish/status/fetch/`, {
        publish_id: publishId,
      }, accessToken);

      if (statusRes.data.error && statusRes.data.error.code !== 'ok') {
        throw new Error(`TikTok status check failed: ${statusRes.data.error.message || JSON.stringify(statusRes.data.error)}`);
      }

      status = statusRes.data.data.status;
      if (status === 'PUBLISH_COMPLETE') break;
      if (status === 'FAILED') {
        const reason = statusRes.data.data.fail_reason || 'unknown';
        throw new Error(`TikTok publish failed: ${reason}`);
      }
    }

    return { publishId, status };
  } finally {
    cleanup();
  }
}

module.exports = { uploadVideo, downloadVideoToTemp };
