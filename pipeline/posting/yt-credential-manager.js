'use strict';

const fs = require('fs');
const config = require('../config');

const CRED_PATH = config.youtube.credentialsPath;

function loadCredentials() {
  if (!fs.existsSync(CRED_PATH)) return { app: {}, accounts: {} };
  return JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
}

function saveCredentials(data) {
  fs.writeFileSync(CRED_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getAppCredentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID || '';
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || '';
  if (clientId && clientSecret) return { clientId, clientSecret };

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

module.exports = {
  loadCredentials,
  saveCredentials,
  getAppCredentials,
  getAccountCredentials,
  storeAccountCredentials,
  listAuthorizedAccounts,
};
