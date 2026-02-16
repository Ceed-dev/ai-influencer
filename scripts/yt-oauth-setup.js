#!/usr/bin/env node
'use strict';

/**
 * YouTube OAuth 2.0 authorization CLI.
 * Authorizes one YouTube account at a time and stores refresh tokens in .yt-credentials.json.
 *
 * Usage:
 *   node scripts/yt-oauth-setup.js [accountId]
 *   node scripts/yt-oauth-setup.js [accountId] --manual
 *
 * If accountId is provided, authorizes that account directly.
 * Otherwise, lists YouTube accounts from Accounts Inventory and prompts for selection.
 * Use --manual for headless environments (URL copy-paste instead of localhost callback).
 */

const http = require('http');
const readline = require('readline');
const { google } = require('googleapis');
const { readSheet } = require('../pipeline/sheets/client');
const config = require('../pipeline/config');
const {
  getAppCredentials,
  storeAccountCredentials,
  listAuthorizedAccounts,
} = require('../pipeline/posting/yt-credential-manager');

const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

function log(msg) {
  console.log(`[yt-oauth ${new Date().toISOString()}] ${msg}`);
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function getYouTubeAccountsFromInventory() {
  const rows = await readSheet(config.google.inventoryIds.accounts, 'inventory!A:Z');
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1)
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    })
    .filter((a) => a.platform === 'YouTube');
}

/**
 * OAuth 2.0 flow using localhost callback (default).
 */
async function authorizeWithCallback(oauth2Client) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
  });

  console.log('\n=== Authorization Required ===');
  console.log('1. Log in to the Google account for this YouTube channel');
  console.log('2. Open this URL in your browser:\n');
  console.log(`   ${authUrl}\n`);
  console.log('3. Authorize the app and wait for the redirect...\n');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost:3000');
        const code = url.searchParams.get('code');
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Error: No authorization code received</h1>');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization successful!</h1><p>You can close this tab.</p>');
        server.close();

        const { tokens } = await oauth2Client.getToken({ code, redirect_uri: REDIRECT_URI });
        resolve(tokens);
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
async function authorizeManual(oauth2Client, rl) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
  });

  console.log('\n=== Manual Authorization (headless mode) ===');
  console.log('1. Open this URL in a browser:\n');
  console.log(`   ${authUrl}\n`);
  console.log('2. Authorize the app');
  console.log('3. Copy the authorization code shown\n');

  const code = await ask(rl, 'Enter authorization code: ');
  if (!code.trim()) {
    throw new Error('No authorization code provided. Aborting.');
  }

  const { tokens } = await oauth2Client.getToken({
    code: code.trim(),
    redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
  });
  return tokens;
}

async function main() {
  const app = getAppCredentials();
  if (!app.clientId || !app.clientSecret) {
    console.error('Error: YouTube API credentials not found.');
    console.error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env or .yt-credentials.json');
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
      log('Fetching YouTube accounts from Accounts Inventory...');
      const accounts = await getYouTubeAccountsFromInventory();

      if (accounts.length === 0) {
        console.log('No YouTube accounts found in Accounts Inventory.');
        process.exit(0);
      }

      console.log('\n=== YouTube Accounts ===');
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

    log(`Starting OAuth 2.0 flow for ${accountId}...`);

    const oauth2Client = new google.auth.OAuth2(
      app.clientId,
      app.clientSecret,
      manualMode ? 'urn:ietf:wg:oauth:2.0:oob' : REDIRECT_URI
    );

    const tokens = manualMode
      ? await authorizeManual(oauth2Client, rl)
      : await authorizeWithCallback(oauth2Client);

    if (!tokens.refresh_token) {
      console.error('Error: No refresh token received. Try revoking access and re-authorizing.');
      process.exit(1);
    }

    // Set credentials and get channel info
    oauth2Client.setCredentials(tokens);
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const channelRes = await youtube.channels.list({ part: 'snippet', mine: true });
    const channel = channelRes.data.items && channelRes.data.items[0];

    const channelId = channel ? channel.id : '';
    const channelTitle = channel ? channel.snippet.title : '';

    storeAccountCredentials(accountId, {
      refreshToken: tokens.refresh_token,
      channelId,
      channelTitle,
      authorizedAt: new Date().toISOString(),
    });

    log(`Success! ${accountId} authorized as "${channelTitle}" (${channelId})`);
    log(`Credentials saved to ${config.youtube.credentialsPath}`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('[yt-oauth] Error:', err.message);
  process.exit(1);
});
