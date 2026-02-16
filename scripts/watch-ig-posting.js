#!/usr/bin/env node
'use strict';

/**
 * PM2-managed Instagram Reels posting scheduler daemon.
 * Polls the IG投稿管理 spreadsheet every 120s and uploads videos
 * for rows whose time window matches the current time.
 *
 * Instagram Graph API rate limit: 200 requests/hour/account.
 * Hourly limit is configurable (default 25 posts/hour).
 */

const {
  getReadyPosts,
  markPosted,
  markError,
} = require('../pipeline/sheets/ig-posting-task-manager');
const { uploadReel } = require('../pipeline/posting/adapters/instagram');
const { getAccountCredentials } = require('../pipeline/posting/ig-credential-manager');

const IG_POLL_INTERVAL = parseInt(process.env.IG_POLL_INTERVAL, 10) || 120000;
const IG_MAX_PER_POLL = parseInt(process.env.IG_MAX_PER_POLL, 10) || 3;
const IG_HOURLY_LIMIT = parseInt(process.env.IG_HOURLY_LIMIT, 10) || 25;

let running = true;
let hourlyUploadCount = 0;
let lastResetHour = -1;

function log(msg) {
  console.log(`[ig-posting ${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function getCurrentHour() {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false });
  return parseInt(fmt.format(new Date()), 10);
}

async function pollOnce() {
  // Reset hourly counter on hour change
  const currentHour = getCurrentHour();
  if (currentHour !== lastResetHour) {
    hourlyUploadCount = 0;
    lastResetHour = currentHour;
    log(`Hourly counter reset (hour: ${currentHour})`);
  }

  // Check hourly limit
  if (hourlyUploadCount >= IG_HOURLY_LIMIT) {
    log(`Hourly limit reached (${hourlyUploadCount}/${IG_HOURLY_LIMIT}). Waiting for next hour.`);
    return;
  }

  const now = new Date();
  const posts = await getReadyPosts(now);

  if (posts.length === 0) return;

  const remaining = IG_HOURLY_LIMIT - hourlyUploadCount;
  const batchSize = Math.min(posts.length, IG_MAX_PER_POLL, remaining);
  log(`Found ${posts.length} ready post(s), processing up to ${batchSize} (hourly: ${hourlyUploadCount}/${IG_HOURLY_LIMIT})`);

  const batch = posts.slice(0, batchSize);

  for (const post of batch) {
    if (!running) break;

    try {
      // Check if account is authorized
      const creds = getAccountCredentials(post.accountId);
      if (!creds) {
        log(`Skipping ${post.characterName} (${post.accountId}): not authorized. Run: npm run ig:setup ${post.accountId}`);
        continue;
      }

      if (!post.driveFileId) {
        log(`Skipping row ${post.rowIndex}: no drive_file_id`);
        continue;
      }

      log(`Uploading reel for ${post.characterName} (${post.accountId})`);

      const result = await uploadReel(post.accountId, {
        driveFileId: post.driveFileId,
        caption: post.caption,
      });

      await markPosted(post.rowIndex, result.mediaId, result.permalink);
      hourlyUploadCount++;
      log(`Uploaded: media_id=${result.mediaId} ${result.permalink} (hourly: ${hourlyUploadCount}/${IG_HOURLY_LIMIT})`);

      // Random delay between uploads (15-30 seconds)
      if (batch.indexOf(post) < batch.length - 1) {
        const delay = randomDelay(15000, 30000);
        log(`Waiting ${Math.round(delay / 1000)}s before next upload...`);
        await sleep(delay);
      }
    } catch (err) {
      const errMsg = err.message || String(err);

      // Rate limit (429) — wait 60 seconds
      if (errMsg.includes('429') || errMsg.includes('rate') || errMsg.includes('limit')) {
        log(`Instagram rate limit hit. Waiting 60s.`);
        await markError(post.rowIndex, 'rate_limit');
        await sleep(60000);
        break;
      }

      // Auth/OAuth errors — mark and skip
      if (errMsg.includes('OAuthException') || errMsg.includes('Invalid OAuth') || errMsg.includes('access token')) {
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
  log(`IG posting scheduler started (poll: ${IG_POLL_INTERVAL}ms, max: ${IG_MAX_PER_POLL}/poll, hourly limit: ${IG_HOURLY_LIMIT})`);
  log('Watching for ready posts in IG投稿管理 spreadsheet...');
  log('Press Ctrl+C to stop gracefully.');

  while (running) {
    try {
      await pollOnce();
    } catch (err) {
      log(`Poll error: ${err.message}`);
    }

    // Wait for poll interval, check running flag every second
    const intervals = Math.ceil(IG_POLL_INTERVAL / 1000);
    for (let i = 0; i < intervals && running; i++) {
      await sleep(1000);
    }
  }

  log('IG posting scheduler stopped.');
}

// Graceful shutdown
function shutdown(signal) {
  log(`Received ${signal}. Stopping...`);
  running = false;
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('[ig-posting] Fatal error:', err.message);
  process.exit(1);
});
