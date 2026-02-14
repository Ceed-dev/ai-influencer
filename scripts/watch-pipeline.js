#!/usr/bin/env node
'use strict';

const { runSingleJob } = require('../pipeline/orchestrator');
const { getQueuedRows, getProductionRow, updateProductionRow } = require('../pipeline/sheets/production-manager');
const { resolveProductionRow, clearCache } = require('../pipeline/sheets/inventory-reader');

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL, 10) || 30000;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT, 10) || 5;

let running = true;
const activeJobs = new Map(); // video_id → Promise

function log(msg) {
  console.log(`[watcher ${new Date().toISOString()}] ${msg}`);
}

/**
 * Process a single video job. Runs independently as a tracked promise.
 */
async function processJob(row) {
  const videoId = row.video_id;
  const isDryRun = row.pipeline_status === 'queued_dry';

  try {
    const resolved = await resolveProductionRow(row);
    const startTime = Date.now();
    const result = await runSingleJob(videoId, resolved, isDryRun);
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (result.dryRun) {
      log(`Dry run complete: ${videoId} (${elapsed}s)`);
    } else {
      log(`Completed: ${videoId} (${elapsed}s, folder: ${result.driveFolderId})`);
    }
  } catch (err) {
    log(`Error processing ${videoId}: ${err.message}`);
    try {
      await updateProductionRow(videoId, {
        pipeline_status: 'error',
        error_message: err.message,
      });
    } catch (_) { /* ignore sheet update failure during error handling */ }
  } finally {
    activeJobs.delete(videoId);
    log(`Active jobs: ${activeJobs.size}/${MAX_CONCURRENT}`);
  }
}

/**
 * Poll once: pick up queued rows up to available concurrency slots.
 */
async function pollOnce() {
  const slots = MAX_CONCURRENT - activeJobs.size;
  if (slots <= 0) return;

  clearCache();
  const rows = await getQueuedRows(slots);
  if (rows.length === 0) return;

  for (const row of rows) {
    // Skip if already being processed (race condition guard)
    if (activeJobs.has(row.video_id)) continue;

    const isDryRun = row.pipeline_status === 'queued_dry';
    log(`Starting: ${row.video_id} (${isDryRun ? 'dry run' : 'live'}) [${activeJobs.size + 1}/${MAX_CONCURRENT}]`);

    const jobPromise = processJob(row);
    activeJobs.set(row.video_id, jobPromise);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  log(`Pipeline watcher started (poll: ${POLL_INTERVAL}ms, concurrency: ${MAX_CONCURRENT})`);
  log('Watching for queued/queued_dry rows in production tab...');
  log('Press Ctrl+C to stop gracefully.');

  while (running) {
    try {
      await pollOnce();
    } catch (err) {
      log(`Poll error: ${err.message}`);
    }

    // Wait for poll interval, but check running flag every second for fast shutdown
    const intervals = Math.ceil(POLL_INTERVAL / 1000);
    for (let i = 0; i < intervals && running; i++) {
      await sleep(1000);
    }
  }

  // Wait for all active jobs to finish before exiting
  if (activeJobs.size > 0) {
    log(`Waiting for ${activeJobs.size} active job(s) to finish...`);
    await Promise.allSettled([...activeJobs.values()]);
  }

  log('Watcher stopped.');
}

// Graceful shutdown
function shutdown(signal) {
  const jobCount = activeJobs.size;
  log(`Received ${signal}. ${jobCount > 0 ? `Waiting for ${jobCount} active job(s) to finish...` : 'Stopping...'}`);
  running = false;
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('[watcher] Fatal error:', err.message);
  process.exit(1);
});
