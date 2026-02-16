#!/usr/bin/env node
'use strict';

/**
 * PM2-managed YouTube Shorts posting scheduler daemon.
 * Polls the YT投稿管理 spreadsheet every 120s and uploads videos
 * for rows whose time window matches the current time.
 *
 * Respects YouTube Data API v3 quota limits:
 * - videos.insert = 1,600 units/upload
 * - Default daily quota = 10,000 units → ~6 uploads/day
 */

const {
  getReadyPosts,
  markPosted,
  markError,
} = require('../pipeline/sheets/yt-posting-task-manager');
const { uploadShort } = require('../pipeline/posting/adapters/youtube');
const { getAccountCredentials } = require('../pipeline/posting/yt-credential-manager');

const YT_POLL_INTERVAL = parseInt(process.env.YT_POLL_INTERVAL, 10) || 120000;
const YT_MAX_PER_POLL = parseInt(process.env.YT_MAX_PER_POLL, 10) || 2;
const YT_DAILY_LIMIT = parseInt(process.env.YT_DAILY_LIMIT, 10) || 6;

let running = true;
let dailyUploadCount = 0;
let lastResetDate = '';

function log(msg) {
  console.log(`[yt-posting ${new Date().toISOString()}] ${msg}`);
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
  if (dailyUploadCount >= YT_DAILY_LIMIT) {
    log(`Daily quota reached (${dailyUploadCount}/${YT_DAILY_LIMIT}). Skipping until tomorrow.`);
    return;
  }

  const now = new Date();
  const posts = await getReadyPosts(now);

  if (posts.length === 0) return;

  const remaining = YT_DAILY_LIMIT - dailyUploadCount;
  const batchSize = Math.min(posts.length, YT_MAX_PER_POLL, remaining);
  log(`Found ${posts.length} ready post(s), processing up to ${batchSize} (daily: ${dailyUploadCount}/${YT_DAILY_LIMIT})`);

  const batch = posts.slice(0, batchSize);

  for (const post of batch) {
    if (!running) break;

    try {
      // Check if account is authorized
      const creds = getAccountCredentials(post.accountId);
      if (!creds) {
        log(`Skipping ${post.characterName} (${post.accountId}): not authorized. Run: npm run yt:setup ${post.accountId}`);
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

      const result = await uploadShort(post.accountId, {
        driveFileId: post.driveFileId,
        title: post.title,
        description: post.description,
        tags: post.tags,
        categoryId: post.categoryId,
      });

      await markPosted(post.rowIndex, result.videoId, result.url);
      dailyUploadCount++;
      log(`Uploaded: ${result.url} (daily: ${dailyUploadCount}/${YT_DAILY_LIMIT})`);

      // Random delay between uploads (10-30 seconds) for natural spacing
      if (batch.indexOf(post) < batch.length - 1) {
        const delay = randomDelay(10000, 30000);
        log(`Waiting ${Math.round(delay / 1000)}s before next upload...`);
        await sleep(delay);
      }
    } catch (err) {
      const errMsg = err.message || String(err);

      // Quota exceeded — stop for the day
      if (errMsg.includes('quotaExceeded') || errMsg.includes('dailyLimitExceeded')) {
        log(`YouTube quota exceeded. Stopping uploads for today.`);
        dailyUploadCount = YT_DAILY_LIMIT; // prevent further attempts
        await markError(post.rowIndex, 'quota_exceeded');
        break;
      }

      // Auth errors — mark and skip
      if (err.code === 401 || err.code === 403 || errMsg.includes('invalid_grant')) {
        log(`Auth error for ${post.accountId}: ${errMsg}`);
        await markError(post.rowIndex, `auth_error: ${errMsg.slice(0, 100)}`);
        continue;
      }

      // Other errors — don't mark, retry next poll
      log(`Error uploading row ${post.rowIndex}: ${errMsg}`);
    }
  }
}

async function main() {
  log(`YT posting scheduler started (poll: ${YT_POLL_INTERVAL}ms, max: ${YT_MAX_PER_POLL}/poll, daily limit: ${YT_DAILY_LIMIT})`);
  log('Watching for ready posts in YT投稿管理 spreadsheet...');
  log('Press Ctrl+C to stop gracefully.');

  while (running) {
    try {
      await pollOnce();
    } catch (err) {
      log(`Poll error: ${err.message}`);
    }

    // Wait for poll interval, check running flag every second
    const intervals = Math.ceil(YT_POLL_INTERVAL / 1000);
    for (let i = 0; i < intervals && running; i++) {
      await sleep(1000);
    }
  }

  log('YT posting scheduler stopped.');
}

// Graceful shutdown
function shutdown(signal) {
  log(`Received ${signal}. Stopping...`);
  running = false;
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('[yt-posting] Fatal error:', err.message);
  process.exit(1);
});
