#!/usr/bin/env node
'use strict';

const { runSingleJob } = require('../pipeline/orchestrator');
const { getQueuedRows, getProductionRow } = require('../pipeline/sheets/production-manager');
const { resolveProductionRow, clearCache } = require('../pipeline/sheets/inventory-reader');

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL, 10) || 30000;

let running = true;
let processing = false;

function log(msg) {
  console.log(`[watcher ${new Date().toISOString()}] ${msg}`);
}

/**
 * Poll once: pick up the first queued row and process it.
 */
async function pollOnce() {
  clearCache(); // Always fetch latest inventory data each poll cycle
  const rows = await getQueuedRows(1);
  if (rows.length === 0) return;

  const row = rows[0];
  const isDryRun = row.pipeline_status === 'queued_dry';

  log(`Found queued video: ${row.video_id} (${isDryRun ? 'dry run' : 'live'})`);

  processing = true;
  try {
    const resolved = await resolveProductionRow(row);
    const startTime = Date.now();
    const result = await runSingleJob(row.video_id, resolved, isDryRun);
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (result.dryRun) {
      log(`Dry run complete: ${row.video_id} (${elapsed}s)`);
    } else {
      log(`Completed: ${row.video_id} (${elapsed}s, folder: ${result.driveFolderId})`);
    }
  } catch (err) {
    log(`Error processing ${row.video_id}: ${err.message}`);
    // Error is already recorded in the sheet by runSingleJob's catch block.
    // Watcher continues to the next poll.
  } finally {
    processing = false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  log(`Pipeline watcher started (poll interval: ${POLL_INTERVAL}ms)`);
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

  log('Watcher stopped.');
}

// Graceful shutdown
function shutdown(signal) {
  log(`Received ${signal}. ${processing ? 'Waiting for current job to finish...' : 'Stopping...'}`);
  running = false;
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('[watcher] Fatal error:', err.message);
  process.exit(1);
});
