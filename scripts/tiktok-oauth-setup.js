#!/usr/bin/env node
'use strict';

/**
 * TikTok OAuth 2.0 authorization CLI.
 * Authorizes one TikTok account at a time and stores tokens in .tiktok-credentials.json.
 *
 * Usage:
 *   node scripts/tiktok-oauth-setup.js [accountId]
 *   node scripts/tiktok-oauth-setup.js [accountId] --manual
 *
 * If accountId is provided, authorizes that account directly.
 * Otherwise, lists TikTok accounts from Accounts Inventory and prompts for selection.
 * Use --manual for headless environments (URL copy-paste instead of localhost callback).
 */

const http = require('http');
const https = require('https');
const readline = require('readline');
const { readSheet } = require('../pipeline/sheets/client');
const config = require('../pipeline/config');
const {
  getAppCredentials,
  storeAccountCredentials,
  listAuthorizedAccounts,
} = require('../pipeline/posting/tiktok-credential-manager');

const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = 'user.info.basic,video.publish';

function log(msg) {
  console.log(`[tiktok-oauth ${new Date().toISOString()}] ${msg}`);
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

/**
 * POST JSON to TikTok API.
 */
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', (chunk) => { chunks += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(chunks));
        } catch (e) {
          reject(new Error(`Failed to parse TikTok response: ${chunks.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getTikTokAccountsFromInventory() {
  const rows = await readSheet(config.google.inventoryIds.accounts, 'inventory!A:Z');
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1)
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    })
    .filter((a) => a.platform === 'TikTok');
}

/**
 * OAuth 2.0 flow using localhost callback (default).
 */
async function authorizeWithCallback(app) {
  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(app.clientKey)}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=tiktok_auth`;

  console.log('\n=== TikTok Authorization Required ===');
  console.log('1. Log in to the TikTok account');
  console.log('2. Open this URL in your browser:\n');
  console.log(`   ${authUrl}\n`);
  console.log('3. Authorize the app and wait for the redirect...\n');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost:3000');
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>Error: ${error}</h1><p>${url.searchParams.get('error_description') || ''}</p>`);
          server.close();
          reject(new Error(`TikTok auth error: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Error: No authorization code received</h1>');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>TikTok Authorization successful!</h1><p>You can close this tab.</p>');
        server.close();

        // Exchange code for tokens
        const tokenData = await postJson(`${config.tiktok.baseUrl}/v2/oauth/token/`, {
          client_key: app.clientKey,
          client_secret: app.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        });

        if (tokenData.error) {
          reject(new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error}`));
          return;
        }

        resolve(tokenData);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error</h1><p>${err.message}</p>`);
        server.close();
        reject(err);
      }
    });

    server.listen(3000, () => {
      log('Waiting for OAuth callback on http://localhost:3000/callback ...');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error('Port 3000 is already in use. Close the other process or use --manual mode.'));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Manual OAuth 2.0 flow for headless environments.
 */
async function authorizeManual(app, rl) {
  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(app.clientKey)}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=tiktok_auth`;

  console.log('\n=== Manual TikTok Authorization (headless mode) ===');
  console.log('1. Open this URL in a browser:\n');
  console.log(`   ${authUrl}\n`);
  console.log('2. Authorize the app');
  console.log('3. Copy the "code" parameter from the redirect URL\n');

  const code = await ask(rl, 'Enter authorization code: ');
  if (!code.trim()) {
    throw new Error('No authorization code provided. Aborting.');
  }

  const tokenData = await postJson(`${config.tiktok.baseUrl}/v2/oauth/token/`, {
    client_key: app.clientKey,
    client_secret: app.clientSecret,
    code: code.trim(),
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
  });

  if (tokenData.error) {
    throw new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
  }

  return tokenData;
}

async function main() {
  const app = getAppCredentials();
  if (!app.clientKey || !app.clientSecret) {
    console.error('Error: TikTok API credentials not found.');
    console.error('Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in .env or .tiktok-credentials.json');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const manualMode = args.includes('--manual');
  const targetAccountId = args.find((a) => !a.startsWith('--'));
  const authorized = listAuthorizedAccounts();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    let accountId;

    if (targetAccountId) {
      accountId = targetAccountId;
      log(`Authorizing account: ${accountId}`);
    } else {
      log('Fetching TikTok accounts from Accounts Inventory...');
      const accounts = await getTikTokAccountsFromInventory();

      if (accounts.length === 0) {
        console.log('No TikTok accounts found in Accounts Inventory.');
        process.exit(0);
      }

      console.log('\n=== TikTok Accounts ===');
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

    log(`Starting TikTok OAuth 2.0 flow for ${accountId}...`);

    const tokenData = manualMode
      ? await authorizeManual(app, rl)
      : await authorizeWithCallback(app);

    if (!tokenData.access_token) {
      console.error('Error: No access token received.');
      process.exit(1);
    }

    storeAccountCredentials(accountId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in || 86400) * 1000,
      openId: tokenData.open_id || '',
      authorizedAt: new Date().toISOString(),
    });

    log(`Success! ${accountId} authorized (open_id: ${tokenData.open_id || 'N/A'})`);
    log(`Credentials saved to ${config.tiktok.credentialsPath}`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('[tiktok-oauth] Error:', err.message);
  process.exit(1);
});
