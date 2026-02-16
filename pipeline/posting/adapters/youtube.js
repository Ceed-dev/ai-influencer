'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { google } = require('googleapis');
const config = require('../../config');
const { getDrive } = require('../../sheets/client');
const {
  getAppCredentials,
  getAccountCredentials,
} = require('../yt-credential-manager');

/**
 * Create an OAuth2 client for a specific YouTube account using per-account refresh token.
 */
function getYouTubeClientForAccount(accountId) {
  const app = getAppCredentials();
  if (!app.clientId || !app.clientSecret) {
    throw new Error('YouTube API app credentials not configured (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET)');
  }

  const account = getAccountCredentials(accountId);
  if (!account || !account.refreshToken) {
    throw new Error(`No OAuth credentials for YouTube account ${accountId}. Run: npm run yt:setup ${accountId}`);
  }

  const oauth2 = new google.auth.OAuth2(app.clientId, app.clientSecret);
  oauth2.setCredentials({ refresh_token: account.refreshToken });
  return google.youtube({ version: 'v3', auth: oauth2 });
}

/**
 * Download a video from Google Drive to a temporary file.
 * Returns { tmpPath, cleanup } where cleanup() deletes the tmp file.
 */
async function downloadVideoToTemp(driveFileId) {
  const drive = getDrive();
  const tmpPath = path.join(os.tmpdir(), `yt-upload-${driveFileId}-${Date.now()}.mp4`);

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

/**
 * Upload a video as a YouTube Short from a specific account.
 * Downloads the video from Drive to a tmp file, then uploads to YouTube.
 *
 * @param {string} accountId - Account ID (e.g. ACC_0003)
 * @param {object} opts
 * @param {string} opts.driveFileId - Google Drive file ID of the final.mp4
 * @param {string} opts.title - YouTube video title
 * @param {string} opts.description - YouTube video description
 * @param {string[]} [opts.tags] - Video tags
 * @param {string} [opts.categoryId] - YouTube category ID (default '22')
 * @returns {{ videoId: string, url: string }}
 */
async function uploadShort(accountId, { driveFileId, title, description, tags, categoryId }) {
  if (!driveFileId) throw new Error('driveFileId is required');
  if (!title) throw new Error('title is required');

  const youtube = getYouTubeClientForAccount(accountId);
  const { tmpPath, cleanup } = await downloadVideoToTemp(driveFileId);

  try {
    const res = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title,
          description: description ? `${description}\n#Shorts` : '#Shorts',
          tags: tags || [],
          categoryId: categoryId || '22', // People & Blogs
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(tmpPath),
      },
    });

    const videoId = res.data.id;
    return {
      videoId,
      url: `https://youtube.com/shorts/${videoId}`,
    };
  } finally {
    cleanup();
  }
}

/**
 * Legacy single-channel upload (backward-compatible with poster.js).
 * Uses config.youtube.refreshToken directly.
 */
async function upload({ videoPath, title, description, tags, categoryId }) {
  const oauth2 = new google.auth.OAuth2(
    config.youtube.clientId,
    config.youtube.clientSecret
  );
  oauth2.setCredentials({ refresh_token: config.youtube.refreshToken });
  const youtube = google.youtube({ version: 'v3', auth: oauth2 });

  const res = await youtube.videos.insert({
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title,
        description: `${description}\n#Shorts`,
        tags: tags || [],
        categoryId: categoryId || '22',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  const videoId = res.data.id;
  return {
    videoId,
    url: `https://youtube.com/shorts/${videoId}`,
  };
}

module.exports = { upload, uploadShort, downloadVideoToTemp, getYouTubeClientForAccount };
