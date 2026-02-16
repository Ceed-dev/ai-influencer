#!/usr/bin/env node
'use strict';

/**
 * Instagram (Facebook) OAuth 2.0 authorization CLI.
 * Authorizes one Instagram account at a time and stores tokens in .ig-credentials.json.
 *
 * Usage:
 *   node scripts/ig-oauth-setup.js [accountId]
 *   node scripts/ig-oauth-setup.js [accountId] --manual
 *
 * If accountId is provided, authorizes that account directly.
 * Otherwise, lists Instagram accounts from Accounts Inventory and prompts for selection.
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
} = require('../pipeline/posting/ig-credential-manager');

const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = 'instagram_basic,instagram_content_publish,pages_show_list';

function log(msg) {
  console.log(`[ig-oauth ${new Date().toISOString()}] ${msg}`);
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

/**
 * GET JSON from a URL.
 */
function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let chunks = '';
      res.on('data', (chunk) => { chunks += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(chunks));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${chunks.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function getInstagramAccountsFromInventory() {
  const rows = await readSheet(config.google.inventoryIds.accounts, 'inventory!A:Z');
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1)
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    })
    .filter((a) => a.platform === 'Instagram');
}

/**
 * Exchange short-lived token for long-lived token.
 */
async function exchangeForLongLivedToken(shortLivedToken, app) {
  const url = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(app.appSecret)}&access_token=${encodeURIComponent(shortLivedToken)}`;
  const data = await getJson(url);
  if (data.error) {
    throw new Error(`Long-lived token exchange failed: ${data.error.message}`);
  }
  return data;
}

/**
 * Get Instagram Business Account ID from the user's pages.
 */
async function getIgUserId(accessToken) {
  const url = `https://graph.facebook.com/${config.instagram.graphApiVersion}/me/accounts?fields=instagram_business_account,name&access_token=${encodeURIComponent(accessToken)}`;
  const data = await getJson(url);
  if (data.error) {
    throw new Error(`Failed to get pages: ${data.error.message}`);
  }

  if (!data.data || data.data.length === 0) {
    throw new Error('No Facebook Pages found. Ensure the account has an Instagram Business Account connected to a Facebook Page.');
  }

  for (const page of data.data) {
    if (page.instagram_business_account) {
      return {
        igUserId: page.instagram_business_account.id,
        pageId: page.id,
        pageName: page.name,
      };
    }
  }

  throw new Error('No Instagram Business Account found connected to any Facebook Page.');
}

/**
 * OAuth 2.0 flow using localhost callback (default).
 */
async function authorizeWithCallback(app) {
  const authUrl = `https://www.facebook.com/${config.instagram.graphApiVersion}/dialog/oauth?client_id=${encodeURIComponent(app.appId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&response_type=code&state=ig_auth`;

  console.log('\n=== Instagram (Facebook) Authorization Required ===');
  console.log('1. Log in to the Facebook account linked to the Instagram account');
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
          reject(new Error(`Facebook auth error: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Error: No authorization code received</h1>');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Instagram Authorization successful!</h1><p>You can close this tab.</p>');
        server.close();

        // Exchange code for short-lived token
        const tokenUrl = `https://graph.facebook.com/${config.instagram.graphApiVersion}/oauth/access_token?client_id=${encodeURIComponent(app.appId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${encodeURIComponent(app.appSecret)}&code=${encodeURIComponent(code)}`;
        const tokenData = await getJson(tokenUrl);

        if (tokenData.error) {
          reject(new Error(`Token exchange failed: ${tokenData.error.message}`));
          return;
        }

        resolve(tokenData.access_token);
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
  const authUrl = `https://www.facebook.com/${config.instagram.graphApiVersion}/dialog/oauth?client_id=${encodeURIComponent(app.appId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&response_type=code&state=ig_auth`;

  console.log('\n=== Manual Instagram Authorization (headless mode) ===');
  console.log('1. Open this URL in a browser:\n');
  console.log(`   ${authUrl}\n`);
  console.log('2. Authorize the app');
  console.log('3. Copy the "code" parameter from the redirect URL\n');

  const code = await ask(rl, 'Enter authorization code: ');
  if (!code.trim()) {
    throw new Error('No authorization code provided. Aborting.');
  }

  const tokenUrl = `https://graph.facebook.com/${config.instagram.graphApiVersion}/oauth/access_token?client_id=${encodeURIComponent(app.appId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${encodeURIComponent(app.appSecret)}&code=${encodeURIComponent(code.trim())}`;
  const tokenData = await getJson(tokenUrl);

  if (tokenData.error) {
    throw new Error(`Token exchange failed: ${tokenData.error.message}`);
  }

  return tokenData.access_token;
}

async function main() {
  const app = getAppCredentials();
  if (!app.appId || !app.appSecret) {
    console.error('Error: Instagram/Facebook API credentials not found.');
    console.error('Set IG_APP_ID and IG_APP_SECRET in .env or .ig-credentials.json');
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
      log('Fetching Instagram accounts from Accounts Inventory...');
      const accounts = await getInstagramAccountsFromInventory();

      if (accounts.length === 0) {
        console.log('No Instagram accounts found in Accounts Inventory.');
        process.exit(0);
      }

      console.log('\n=== Instagram Accounts ===');
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

    log(`Starting Facebook/Instagram OAuth 2.0 flow for ${accountId}...`);

    // Get short-lived token
    const shortLivedToken = manualMode
      ? await authorizeManual(app, rl)
      : await authorizeWithCallback(app);

    // Exchange for long-lived token
    log('Exchanging for long-lived token...');
    const longLivedData = await exchangeForLongLivedToken(shortLivedToken, app);

    // Get Instagram Business Account ID
    log('Looking up Instagram Business Account...');
    const { igUserId, pageId, pageName } = await getIgUserId(longLivedData.access_token);

    // Get IG username
    let igUsername = '';
    try {
      const igInfo = await getJson(
        `https://graph.instagram.com/${config.instagram.graphApiVersion}/${igUserId}?fields=username&access_token=${encodeURIComponent(longLivedData.access_token)}`
      );
      igUsername = igInfo.username || '';
    } catch (_) { /* username is optional */ }

    storeAccountCredentials(accountId, {
      accessToken: longLivedData.access_token,
      igUserId,
      igUsername,
      pageId,
      tokenExpiresAt: Date.now() + (longLivedData.expires_in || 5184000) * 1000,
      authorizedAt: new Date().toISOString(),
    });

    log(`Success! ${accountId} authorized as @${igUsername || igUserId} (page: ${pageName})`);
    log(`Credentials saved to ${config.instagram.credentialsPath}`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('[ig-oauth] Error:', err.message);
  process.exit(1);
});
