'use strict';

const fs = require('fs');
const https = require('https');
const config = require('../config');

const CRED_PATH = config.instagram.credentialsPath;

function loadCredentials() {
  if (!fs.existsSync(CRED_PATH)) return { app: {}, accounts: {} };
  return JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
}

function saveCredentials(data) {
  fs.writeFileSync(CRED_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getAppCredentials() {
  const appId = process.env.IG_APP_ID || '';
  const appSecret = process.env.IG_APP_SECRET || '';
  if (appId && appSecret) return { appId, appSecret };

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
 * GET request using Node.js stdlib https.
 * Returns parsed JSON response.
 */
function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let chunks = '';
      res.on('data', (chunk) => { chunks += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(chunks) });
        } catch (e) {
          reject(new Error(`Failed to parse Instagram response: ${chunks.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Refresh a long-lived token for an Instagram account.
 * Long-lived tokens are valid for 60 days and can be refreshed when still valid.
 * GET /oauth/access_token?grant_type=fb_exchange_token
 */
async function refreshLongLivedToken(accountId) {
  const account = getAccountCredentials(accountId);
  if (!account || !account.accessToken) {
    throw new Error(`No access token for Instagram account ${accountId}`);
  }

  const app = getAppCredentials();
  if (!app.appSecret) {
    throw new Error('Instagram app credentials not configured (IG_APP_SECRET)');
  }

  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(account.accessToken)}`;

  const { statusCode, data } = await getJson(url);

  if (statusCode !== 200 || data.error) {
    const errMsg = data.error ? data.error.message : `HTTP ${statusCode}`;
    throw new Error(`Instagram token refresh failed for ${accountId}: ${errMsg}`);
  }

  const updated = {
    ...account,
    accessToken: data.access_token,
    tokenExpiresAt: Date.now() + (data.expires_in || 5184000) * 1000,
  };

  storeAccountCredentials(accountId, updated);
  return updated;
}

/**
 * Get a valid access token for the account.
 * Automatically refreshes if token expires within 7 days.
 */
async function getValidToken(accountId) {
  let account = getAccountCredentials(accountId);
  if (!account) {
    throw new Error(`No credentials for Instagram account ${accountId}. Run: npm run ig:setup ${accountId}`);
  }

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (account.tokenExpiresAt && account.tokenExpiresAt - now < sevenDays) {
    account = await refreshLongLivedToken(accountId);
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
  refreshLongLivedToken,
  getValidToken,
};
