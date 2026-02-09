'use strict';

const config = require('../config');
const { readSheet, appendSheet, writeSheet } = require('./client');

const SHEET_ID = config.google.masterSpreadsheetId;
const TAB = 'accounts';

const HEADERS = [
  'account_id', 'persona_name', 'platform', 'account_handle', 'character_id',
  'target_region', 'timezone', 'posting_window', 'content_niche', 'voice_id',
  'status', 'api_credential_key', 'last_posted_at',
];

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] || ''; });
  return obj;
}

async function getAllAccounts() {
  const rows = await readSheet(SHEET_ID, `${TAB}!A:M`);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) => rowToObj(headers, r));
}

async function getAccount(accountId) {
  const accounts = await getAllAccounts();
  return accounts.find((a) => a.account_id === accountId) || null;
}

async function getActiveAccounts(platform) {
  const accounts = await getAllAccounts();
  return accounts.filter((a) => {
    if (a.status !== 'active') return false;
    if (platform && a.platform !== platform) return false;
    return true;
  });
}

async function createAccount(data) {
  const accounts = await getAllAccounts();
  const maxNum = accounts.reduce((max, a) => {
    const m = a.account_id.match(/ACC_(\d+)/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  const accountId = `ACC_${String(maxNum + 1).padStart(4, '0')}`;

  const row = HEADERS.map((h) => {
    if (h === 'account_id') return accountId;
    if (h === 'status') return data.status || 'active';
    return data[h] || '';
  });

  await appendSheet(SHEET_ID, `${TAB}!A:M`, [row]);
  return accountId;
}

async function updateAccount(accountId, updates) {
  const rows = await readSheet(SHEET_ID, `${TAB}!A:M`);
  if (rows.length < 2) throw new Error(`Account ${accountId} not found`);

  const headers = rows[0];
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === accountId);
  if (idx === -1) throw new Error(`Account ${accountId} not found`);

  const row = rows[idx];
  for (const [key, val] of Object.entries(updates)) {
    const col = headers.indexOf(key);
    if (col !== -1) row[col] = val;
  }

  const rowNum = idx + 1; // 1-indexed
  await writeSheet(SHEET_ID, `${TAB}!A${rowNum}:M${rowNum}`, [row]);
}

module.exports = { getAccount, getActiveAccounts, createAccount, updateAccount };
