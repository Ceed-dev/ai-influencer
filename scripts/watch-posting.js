#!/usr/bin/env node
'use strict';

/**
 * PM2-managed posting scheduler daemon.
 * Polls the X投稿管理 spreadsheet every 60s and posts tweets
 * for rows whose time window matches the current time.
 */

const {
  getReadyPosts,
  buildTweetText,
  markPosted,
  markError,
} = require('../pipeline/sheets/posting-task-manager');
const { postTweet } = require('../pipeline/posting/adapters/twitter');
const { getAccountCredentials } = require('../pipeline/posting/x-credential-manager');

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL, 10) || 60000;
const MAX_PER_POLL = parseInt(process.env.MAX_PER_POLL, 10) || 3;

let running = true;

function log(msg) {
  console.log(`[posting ${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

async function pollOnce() {
  const now = new Date();
  const posts = await getReadyPosts(now);

  if (posts.length === 0) return;

  log(`Found ${posts.length} ready post(s), processing up to ${MAX_PER_POLL}`);

  const batch = posts.slice(0, MAX_PER_POLL);

  for (const post of batch) {
    if (!running) break;

    try {
      // Check if account is authorized
      const creds = getAccountCredentials(post.accountId);
      if (!creds) {
        log(`Skipping ${post.characterName} (${post.accountId}): not authorized. Run: npm run x:setup ${post.accountId}`);
        continue;
      }

      const text = buildTweetText(post.body, post.hashtags);
      if (!text) {
        log(`Skipping row ${post.rowIndex}: empty tweet text`);
        continue;
      }

      log(`Posting for ${post.characterName} (${post.accountId}): ${text.slice(0, 50)}...`);

      const result = await postTweet(post.accountId, text);

      await markPosted(post.rowIndex, result.tweetId, result.url);
      log(`Posted: ${result.url}`);

      // Random delay between posts (5-15 seconds) for natural spacing
      if (batch.indexOf(post) < batch.length - 1) {
        const delay = randomDelay(5000, 15000);
        log(`Waiting ${Math.round(delay / 1000)}s before next post...`);
        await sleep(delay);
      }
    } catch (err) {
      if (err.code === 429 || (err.data && err.data.status === 429)) {
        // Rate limited — stop this poll, retry next cycle
        const retryAfter = (err.rateLimit && err.rateLimit.reset)
          ? Math.max(0, err.rateLimit.reset * 1000 - Date.now())
          : 60000;
        log(`Rate limited. Waiting ${Math.round(retryAfter / 1000)}s`);
        await sleep(retryAfter);
        break;
      }

      if (err.code === 401 || err.code === 403) {
        log(`Auth error for ${post.accountId}: ${err.message}`);
        await markError(post.rowIndex, `auth_error: ${err.message.slice(0, 100)}`);
        continue;
      }

      log(`Error posting row ${post.rowIndex}: ${err.message}`);
      // Don't mark error for transient failures — retry next poll
    }
  }
}

async function main() {
  log(`Posting scheduler started (poll: ${POLL_INTERVAL}ms, max: ${MAX_PER_POLL}/poll)`);
  log('Watching for ready posts in X投稿管理 spreadsheet...');
  log('Press Ctrl+C to stop gracefully.');

  while (running) {
    try {
      await pollOnce();
    } catch (err) {
      log(`Poll error: ${err.message}`);
    }

    // Wait for poll interval, check running flag every second
    const intervals = Math.ceil(POLL_INTERVAL / 1000);
    for (let i = 0; i < intervals && running; i++) {
      await sleep(1000);
    }
  }

  log('Posting scheduler stopped.');
}

// Graceful shutdown
function shutdown(signal) {
  log(`Received ${signal}. Stopping...`);
  running = false;
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('[posting] Fatal error:', err.message);
  process.exit(1);
});
