#!/usr/bin/env node
'use strict';

const { getAccount } = require('../pipeline/sheets/account-manager');
const { createContent, updateContentStatus } = require('../pipeline/sheets/content-manager');
const { post } = require('../pipeline/posting/poster');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { account: null, dryRun: false, skipPost: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--account' && args[i + 1]) opts.account = args[++i];
    if (args[i] === '--dry-run') opts.dryRun = true;
    if (args[i] === '--skip-post') opts.skipPost = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  if (!opts.account) {
    console.error('Usage: node scripts/run-pipeline.js --account ACC_0001 [--dry-run] [--skip-post]');
    process.exit(1);
  }

  console.log(`[pipeline] Starting for account: ${opts.account}`);

  const account = await getAccount(opts.account);
  if (!account) {
    console.error(`Account ${opts.account} not found`);
    process.exit(1);
  }
  console.log(`[pipeline] Account: ${account.persona_name} (${account.platform})`);

  const contentId = await createContent({ account_id: opts.account });
  console.log(`[pipeline] Created content entry: ${contentId}`);

  if (opts.dryRun) {
    console.log('[pipeline] Dry run — skipping video generation and posting');
    return;
  }

  // TODO: call orchestrator to generate video
  // const result = await orchestrate(account, contentId);
  console.log('[pipeline] Video generation not yet wired — skipping');

  if (!opts.skipPost) {
    // TODO: post once video generation is complete
    // const postResult = await post({ platform: account.platform, videoPath: result.videoPath, metadata: { ... } });
    console.log('[pipeline] Posting not yet wired — skipping');
  }

  console.log(`[pipeline] Done. Content ID: ${contentId}`);
}

main().catch((err) => {
  console.error('[pipeline] Fatal error:', err.message);
  process.exit(1);
});
