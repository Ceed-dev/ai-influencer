#!/usr/bin/env node
'use strict';

const { runSingleJob, processReadyJobs } = require('../pipeline/orchestrator');
const { getProductionRow } = require('../pipeline/sheets/production-manager');
const { resolveProductionRow } = require('../pipeline/sheets/inventory-reader');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    videoId: null,
    limit: 10,
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--video-id' && args[i + 1]) opts.videoId = args[++i];
    if (args[i] === '--limit' && args[i + 1]) opts.limit = parseInt(args[++i], 10);
    if (args[i] === '--dry-run') opts.dryRun = true;
    if (args[i] === '--help' || args[i] === '-h') {
      showUsage();
      process.exit(0);
    }
  }
  return opts;
}

function showUsage() {
  console.log(`Usage:
  node scripts/run-pipeline.js                              Process ready rows from production sheet
  node scripts/run-pipeline.js --video-id VID_202602_0001   Process a specific video
  node scripts/run-pipeline.js --limit 5                    Process at most 5 ready rows
  node scripts/run-pipeline.js --dry-run                    Log steps without API calls

Options:
  --video-id <ID>          Process a specific video_id from the production tab
  --limit <N>              Max number of ready rows to process (default: 10)
  --dry-run                Skip all API calls, just log what would happen
  --help, -h               Show this help message
`);
}

async function runSingleVideoMode(opts) {
  console.log(`[pipeline] Processing single video: ${opts.videoId}`);
  console.log(`[pipeline] Dry run: ${opts.dryRun}`);

  const row = await getProductionRow(opts.videoId);
  if (!row) {
    console.error(`[pipeline] Video ${opts.videoId} not found in production tab`);
    process.exit(1);
  }

  const resolved = await resolveProductionRow(row);
  const startTime = Date.now();
  const result = await runSingleJob(opts.videoId, resolved, opts.dryRun);
  const elapsed = Math.round((Date.now() - startTime) / 1000);

  console.log('\n=== Pipeline Result ===');
  console.log(`Video ID: ${result.videoId}`);
  console.log(`Time: ${elapsed}s`);
  if (result.dryRun) {
    console.log('(dry run — no files generated)');
  } else {
    console.log(`Drive folder: ${result.driveFolderId}`);
    if (result.driveUrls) {
      console.log('Files:');
      for (const [name, url] of Object.entries(result.driveUrls)) {
        console.log(`  ${name}: ${url}`);
      }
    }
  }
}

async function runBatchMode(opts) {
  console.log(`[pipeline] Processing ready rows (limit: ${opts.limit})`);
  console.log(`[pipeline] Dry run: ${opts.dryRun}`);

  const startTime = Date.now();
  const summary = await processReadyJobs({ dryRun: opts.dryRun, limit: opts.limit });
  const elapsed = Math.round((Date.now() - startTime) / 1000);

  console.log('\n=== Batch Summary ===');
  console.log(`Total: ${summary.total}`);
  console.log(`Succeeded: ${summary.succeeded}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Time: ${elapsed}s`);

  if (summary.results.length > 0) {
    console.log('\nDetails:');
    for (const r of summary.results) {
      if (r.status === 'completed') {
        console.log(`  ${r.videoId}: completed`);
      } else {
        console.log(`  ${r.videoId}: ERROR - ${r.error}`);
      }
    }
  }
}

async function main() {
  const opts = parseArgs();

  // Single video mode
  if (opts.videoId) {
    return runSingleVideoMode(opts);
  }

  // Batch processing
  return runBatchMode(opts);
}

main().catch((err) => {
  console.error('[pipeline] Fatal error:', err.message);
  process.exit(1);
});
