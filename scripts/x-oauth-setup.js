#!/usr/bin/env node
'use strict';

/**
 * X OAuth 1.0a PIN-based authorization CLI.
 * Authorizes one X account at a time and stores tokens in .x-credentials.json.
 *
 * Usage:
 *   node scripts/x-oauth-setup.js [accountId]
 *
 * If accountId is provided, authorizes that account directly.
 * Otherwise, lists X accounts from Accounts Inventory and prompts for selection.
 */

const readline = require('readline');
const { TwitterApi } = require('twitter-api-v2');
const { readSheet } = require('../pipeline/sheets/client');
const config = require('../pipeline/config');
const {
  getAppCredentials,
  storeAccountCredentials,
  listAuthorizedAccounts,
} = require('../pipeline/posting/x-credential-manager');

function log(msg) {
  console.log(`[x-oauth ${new Date().toISOString()}] ${msg}`);
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function getXAccountsFromInventory() {
  const rows = await readSheet(config.google.inventoryIds.accounts, 'inventory!A:Z');
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1)
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    })
    .filter((a) => a.platform === 'X');
}

async function main() {
  const app = getAppCredentials();
  if (!app.apiKey || !app.apiKeySecret) {
    console.error('Error: X API credentials not found.');
    console.error('Set X_API_KEY and X_API_KEY_SECRET in .env or .x-credentials.json');
    process.exit(1);
  }

  const targetAccountId = process.argv[2];
  const authorized = listAuthorizedAccounts();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    let accountId;

    if (targetAccountId) {
      accountId = targetAccountId;
      log(`Authorizing account: ${accountId}`);
    } else {
      // List X accounts from inventory
      log('Fetching X accounts from Accounts Inventory...');
      const accounts = await getXAccountsFromInventory();

      if (accounts.length === 0) {
        console.log('No X accounts found in Accounts Inventory.');
        process.exit(0);
      }

      console.log('\n=== X Accounts ===');
      accounts.forEach((a, i) => {
        const status = authorized.includes(a.account_id) ? ' [authorized]' : '';
        const handle = a.account_handle ? ` (${a.account_handle})` : '';
        const char = a.character_id ? ` → ${a.character_id}` : '';
        console.log(`  ${i + 1}. ${a.account_id}${handle}${char}${status}`);
      });
      console.log('');

      const choice = await ask(rl, 'Select account number (or "q" to quit): ');
      if (choice.toLowerCase() === 'q') process.exit(0);

      const idx = parseInt(choice, 10) - 1;
      if (idx < 0 || idx >= accounts.length) {
        console.error('Invalid selection.');
        process.exit(1);
      }
      accountId = accounts[idx].account_id;
    }

    log(`Starting OAuth 1.0a PIN-based flow for ${accountId}...`);

    // Step 1: Generate auth link
    const client = new TwitterApi({ appKey: app.apiKey, appSecret: app.apiKeySecret });
    const authLink = await client.generateAuthLink('oob', { linkMode: 'authorize' });

    console.log('\n=== Authorization Required ===');
    console.log('1. Log in to the X account you want to authorize');
    console.log('2. Open this URL in your browser:');
    console.log(`\n   ${authLink.url}\n`);
    console.log('3. Click "Authorize app"');
    console.log('4. Copy the PIN code shown\n');

    const pin = await ask(rl, 'Enter PIN: ');
    if (!pin.trim()) {
      console.error('No PIN provided. Aborting.');
      process.exit(1);
    }

    // Step 2: Exchange PIN for access tokens
    const loginClient = new TwitterApi({
      appKey: app.apiKey,
      appSecret: app.apiKeySecret,
      accessToken: authLink.oauth_token,
      accessSecret: authLink.oauth_token_secret,
    });

    const { client: loggedClient, accessToken, accessSecret } = await loginClient.login(pin.trim());

    // Step 3: Verify by getting the user's handle
    const me = await loggedClient.v2.me();
    const handle = `@${me.data.username}`;

    // Step 4: Store credentials
    storeAccountCredentials(accountId, {
      accessToken,
      accessTokenSecret: accessSecret,
      handle,
      userId: me.data.id,
      authorizedAt: new Date().toISOString(),
    });

    log(`Success! ${accountId} authorized as ${handle}`);
    log(`Credentials saved to ${config.x.credentialsPath}`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('[x-oauth] Error:', err.message);
  process.exit(1);
});
