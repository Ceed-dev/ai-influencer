'use strict';

const fs = require('fs');
const https = require('https');
const config = require('../config');

const CRED_PATH = config.tiktok.credentialsPath;

function loadCredentials() {
  if (!fs.existsSync(CRED_PATH)) return { app: {}, accounts: {} };
  return JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
}

function saveCredentials(data) {
  fs.writeFileSync(CRED_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getAppCredentials() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY || '';
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || '';
  if (clientKey && clientSecret) return { clientKey, clientSecret };

  const creds = loadCredentials();
  return creds.app || {};
}

function getAccountCredentials(accountId) {
  const creds = loadCredentials();
  return (creds.accounts && creds.accounts[accountId]) || null;
}

function storeAccountCredentials(accountId, tokens) {
  const creds = loadCredentials();
  if (!creds.accounts) creds.accounts = {};
  creds.accounts[accountId] = tokens;
  saveCredentials(creds);
}

function listAuthorizedAccounts() {
  const creds = loadCredentials();
  return Object.keys(creds.accounts || {});
}

/**
 * POST JSON to a URL using Node.js stdlib https.
 * Returns parsed JSON response.
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
          resolve({ statusCode: res.statusCode, data: JSON.parse(chunks) });
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

/**
 * Refresh the access token for a TikTok account.
 * TikTok access tokens expire after 24 hours.
 * POST https://open.tiktokapis.com/v2/oauth/token/
 */
async function refreshAccessToken(accountId) {
  const account = getAccountCredentials(accountId);
  if (!account || !account.refreshToken) {
    throw new Error(`No refresh token for TikTok account ${accountId}`);
  }

  const app = getAppCredentials();
  if (!app.clientKey || !app.clientSecret) {
    throw new Error('TikTok app credentials not configured (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET)');
  }

  const { statusCode, data } = await postJson(`${config.tiktok.baseUrl}/v2/oauth/token/`, {
    client_key: app.clientKey,
    client_secret: app.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: account.refreshToken,
  });

  if (statusCode !== 200 || data.error) {
    const errMsg = data.error_description || data.error || `HTTP ${statusCode}`;
    throw new Error(`TikTok token refresh failed for ${accountId}: ${errMsg}`);
  }

  const updated = {
    ...account,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || account.refreshToken,
    expiresAt: Date.now() + (data.expires_in || 86400) * 1000,
    openId: data.open_id || account.openId,
  };

  storeAccountCredentials(accountId, updated);
  return updated;
}

/**
 * Get a valid access token for the account.
 * Automatically refreshes if expired or about to expire (within 5 minutes).
 */
async function getValidToken(accountId) {
  let account = getAccountCredentials(accountId);
  if (!account) {
    throw new Error(`No credentials for TikTok account ${accountId}. Run: npm run tiktok:setup ${accountId}`);
  }

  const now = Date.now();
  const buffer = 5 * 60 * 1000; // 5 minutes buffer

  if (!account.accessToken || !account.expiresAt || account.expiresAt - now < buffer) {
    account = await refreshAccessToken(accountId);
  }

  return account.accessToken;
}

module.exports = {
  loadCredentials,
  saveCredentials,
  getAppCredentials,
  getAccountCredentials,
  storeAccountCredentials,
  listAuthorizedAccounts,
  refreshAccessToken,
  getValidToken,
};
