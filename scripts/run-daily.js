#!/usr/bin/env node
'use strict';

const { getActiveAccounts } = require('../pipeline/sheets/account-manager');
const { execFileSync } = require('child_process');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { platform: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--platform' && args[i + 1]) opts.platform = args[++i];
    if (args[i] === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  console.log('[daily] Starting daily pipeline run');

  const accounts = await getActiveAccounts(opts.platform);
  console.log(`[daily] Found ${accounts.length} active account(s)${opts.platform ? ` for ${opts.platform}` : ''}`);

  if (accounts.length === 0) {
    console.log('[daily] No active accounts — nothing to do');
    return;
  }

  const pipelineScript = path.resolve(__dirname, 'run-pipeline.js');
  let succeeded = 0;
  let failed = 0;

  for (const account of accounts) {
    console.log(`\n[daily] Running pipeline for ${account.account_id} (${account.persona_name})`);
    try {
      const args = [pipelineScript, '--account', account.account_id];
      if (opts.dryRun) args.push('--dry-run');
      execFileSync('node', args, { stdio: 'inherit' });
      succeeded++;
    } catch (err) {
      console.error(`[daily] Failed for ${account.account_id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n[daily] Done. Succeeded: ${succeeded}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('[daily] Fatal error:', err.message);
  process.exit(1);
});
