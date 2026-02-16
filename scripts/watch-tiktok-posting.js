#!/usr/bin/env node
'use strict';

/**
 * PM2-managed TikTok posting scheduler daemon.
 * Polls the TikTok投稿管理 spreadsheet every 120s and uploads videos
 * for rows whose time window matches the current time.
 *
 * TikTok rate limit: 6 requests/user/minute.
 * Daily limit is configurable (default 50).
 */

const {
  getReadyPosts,
  markPosted,
  markError,
} = require('../pipeline/sheets/tiktok-posting-task-manager');
const { uploadVideo } = require('../pipeline/posting/adapters/tiktok');
const { getAccountCredentials } = require('../pipeline/posting/tiktok-credential-manager');

const TIKTOK_POLL_INTERVAL = parseInt(process.env.TIKTOK_POLL_INTERVAL, 10) || 120000;
const TIKTOK_MAX_PER_POLL = parseInt(process.env.TIKTOK_MAX_PER_POLL, 10) || 3;
const TIKTOK_DAILY_LIMIT = parseInt(process.env.TIKTOK_DAILY_LIMIT, 10) || 50;

let running = true;
let dailyUploadCount = 0;
let lastResetDate = '';

function log(msg) {
  console.log(`[tiktok-posting ${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function getTodayStr() {
  const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date());
}

async function pollOnce() {
  // Reset daily counter on date change
  const today = getTodayStr();
  if (today !== lastResetDate) {
    dailyUploadCount = 0;
    lastResetDate = today;
    log(`Daily counter reset for ${today}`);
  }

  // Check daily quota
  if (dailyUploadCount >= TIKTOK_DAILY_LIMIT) {
    log(`Daily limit reached (${dailyUploadCount}/${TIKTOK_DAILY_LIMIT}). Skipping until tomorrow.`);
    return;
  }

  const now = new Date();
  const posts = await getReadyPosts(now);

  if (posts.length === 0) return;

  const remaining = TIKTOK_DAILY_LIMIT - dailyUploadCount;
  const batchSize = Math.min(posts.length, TIKTOK_MAX_PER_POLL, remaining);
  log(`Found ${posts.length} ready post(s), processing up to ${batchSize} (daily: ${dailyUploadCount}/${TIKTOK_DAILY_LIMIT})`);

  const batch = posts.slice(0, batchSize);

  for (const post of batch) {
    if (!running) break;

    try {
      // Check if account is authorized
      const creds = getAccountCredentials(post.accountId);
      if (!creds) {
        log(`Skipping ${post.characterName} (${post.accountId}): not authorized. Run: npm run tiktok:setup ${post.accountId}`);
        continue;
      }

      if (!post.driveFileId) {
        log(`Skipping row ${post.rowIndex}: no drive_file_id`);
        continue;
      }

      if (!post.title) {
        log(`Skipping row ${post.rowIndex}: no title`);
        continue;
      }

      log(`Uploading for ${post.characterName} (${post.accountId}): "${post.title}"`);

      const result = await uploadVideo(post.accountId, {
        driveFileId: post.driveFileId,
        title: post.title,
        privacyLevel: post.privacyLevel,
      });

      await markPosted(post.rowIndex, result.publishId, result.status);
      dailyUploadCount++;
      log(`Uploaded: publish_id=${result.publishId} status=${result.status} (daily: ${dailyUploadCount}/${TIKTOK_DAILY_LIMIT})`);

      // Random delay between uploads (15-30 seconds) for rate limit compliance
      if (batch.indexOf(post) < batch.length - 1) {
        const delay = randomDelay(15000, 30000);
        log(`Waiting ${Math.round(delay / 1000)}s before next upload...`);
        await sleep(delay);
      }
    } catch (err) {
      const errMsg = err.message || String(err);

      // Rate limit — wait 60 seconds
      if (errMsg.includes('rate_limit') || errMsg.includes('spam_risk')) {
        log(`TikTok rate limit hit. Waiting 60s before retrying.`);
        await markError(post.rowIndex, 'rate_limit');
        await sleep(60000);
        break;
      }

      // Auth errors — mark and skip
      if (errMsg.includes('access_token') || errMsg.includes('token') || errMsg.includes('auth')) {
        log(`Auth error for ${post.accountId}: ${errMsg}`);
        await markError(post.rowIndex, `auth_error: ${errMsg.slice(0, 100)}`);
        continue;
      }

      // Other errors — mark error
      log(`Error uploading row ${post.rowIndex}: ${errMsg}`);
      await markError(post.rowIndex, errMsg.slice(0, 200));
    }
  }
}

async function main() {
  log(`TikTok posting scheduler started (poll: ${TIKTOK_POLL_INTERVAL}ms, max: ${TIKTOK_MAX_PER_POLL}/poll, daily limit: ${TIKTOK_DAILY_LIMIT})`);
  log('Watching for ready posts in TikTok投稿管理 spreadsheet...');
  log('Press Ctrl+C to stop gracefully.');

  while (running) {
    try {
      await pollOnce();
    } catch (err) {
      log(`Poll error: ${err.message}`);
    }

    // Wait for poll interval, check running flag every second
    const intervals = Math.ceil(TIKTOK_POLL_INTERVAL / 1000);
    for (let i = 0; i < intervals && running; i++) {
      await sleep(1000);
    }
  }

  log('TikTok posting scheduler stopped.');
}

// Graceful shutdown
function shutdown(signal) {
  log(`Received ${signal}. Stopping...`);
  running = false;
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('[tiktok-posting] Fatal error:', err.message);
  process.exit(1);
});
