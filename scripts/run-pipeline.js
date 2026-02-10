#!/usr/bin/env node
'use strict';

const { runPipeline } = require('../pipeline/orchestrator');
const { listDriveFiles } = require('../pipeline/sheets/client');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { characterFolder: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--character-folder' && args[i + 1]) opts.characterFolder = args[++i];
    if (args[i] === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  if (!opts.characterFolder) {
    console.error('Usage: node scripts/run-pipeline.js --character-folder <DRIVE_FOLDER_ID> [--dry-run]');
    console.error('');
    console.error('Options:');
    console.error('  --character-folder  Drive folder ID containing character image(s)');
    console.error('  --dry-run           Log pipeline steps without calling APIs');
    process.exit(1);
  }

  console.log(`[pipeline] Character folder: ${opts.characterFolder}`);
  console.log(`[pipeline] Dry run: ${opts.dryRun}`);

  // Validate character folder exists and has images
  const files = await listDriveFiles(opts.characterFolder);
  const images = files.filter((f) => f.mimeType && f.mimeType.startsWith('image/'));
  if (images.length === 0) {
    console.error(`[pipeline] No image files found in Drive folder ${opts.characterFolder}`);
    console.error(`[pipeline] Found ${files.length} files: ${files.map((f) => f.name).join(', ') || '(empty)'}`);
    process.exit(1);
  }
  console.log(`[pipeline] Found ${images.length} character image(s): ${images.map((f) => f.name).join(', ')}`);

  const result = await runPipeline({
    characterFolderId: opts.characterFolder,
    dryRun: opts.dryRun,
  });

  console.log('\n=== Pipeline Result ===');
  console.log(`Content ID: ${result.contentId}`);
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

main().catch((err) => {
  console.error('[pipeline] Fatal error:', err.message);
  process.exit(1);
});
